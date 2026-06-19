/*
  Bad Manners Stockfish challenge layer for Stockfish 18.

  The layer does not replace Stockfish's search. It classifies the root
  position, then reorders already-searched root moves only when BadMannersMode
  is enabled and the candidate move preserves the configured safe score.
*/

#include "bad_manners.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdlib>
#include <limits>
#include <sstream>
#include <string>
#include <unordered_map>

#include "bitboard.h"
#include "movegen.h"
#include "syzygy/tbprobe.h"
#include "types.h"
#include "uci.h"

namespace Stockfish::BadManners {
namespace {

enum class ChallengeResult {
    CompleteKbnMateForceable,
    CompleteKbnMateLikely,
    MaterialCleanupRequired,
    PromotionRequiredAndForceable,
    OnlyPartialSacrificePlanForceable,
    NormalWinRequired,
    ChallengeImpossible
};

enum class ProofLevel {
    ProvenByTablebase,
    ProvenByForcedMateSearch,
    VerifiedToFixedDepth,
    HighConfidenceHeuristic,
    Unproven,
    Impossible
};

enum class MaterialGoal {
    StabilizeWin,
    CreateMissingBishop,
    CreateMissingKnight,
    SacrificeQueen,
    SacrificeRooks,
    SacrificeExtraMinorPieces,
    SacrificeUnusedPawns,
    RemoveEnemyMajorPieces,
    RemoveEnemyMinorPieces,
    RemoveEnemyPawns,
    EnterPureKbnEndgame,
    DeliverKbnMate
};

enum class CurrentResult {
    Winning,
    Drawing,
    Losing,
    Unknown
};

enum class KbnPhase {
    NotKbn,
    CentralizeKing,
    DriveToEdge,
    DriveFromWrongCorner,
    ForceCorrectCorner,
    TightenMateNet,
    DeliverMate
};

enum class ChallengeMilestone {
    None,
    CreateMissingMinors,
    ReachPureKbnk,
    ReachVerifiedKbnMate
};

struct KbnMateVerification {
    bool attempted  = false;
    bool forcedMate = false;
    bool truncated  = false;
    int  depth      = 0;
    int  matePly    = 0;
    int  nodes      = 0;
    int  cacheHits  = 0;
};

struct ChallengeProgressVerification {
    bool               attempted  = false;
    bool               forceable   = false;
    bool               truncated   = false;
    ChallengeMilestone target      = ChallengeMilestone::None;
    int                depth       = 0;
    int                nodes       = 0;
    int                cacheHits   = 0;
    Move               firstMove   = Move::none();
};

struct PieceIdentity {
    PieceType type   = NO_PIECE_TYPE;
    Square    square = SQ_NONE;
    bool      exists = false;
};

struct ChallengeState {
    ChallengeResult result                = ChallengeResult::ChallengeImpossible;
    ProofLevel      proof                 = ProofLevel::Impossible;
    MaterialGoal    goal                  = MaterialGoal::StabilizeWin;
    PieceIdentity   bishop;
    PieceIdentity   knight;
    bool            bishopMustBePromoted  = false;
    bool            knightMustBePromoted  = false;
    Square          cornerA               = SQ_NONE;
    Square          cornerB               = SQ_NONE;
    int             unnecessaryFriendly   = 0;
    int             enemyPieces           = 0;
    int             promotionCandidates   = 0;
    int             promotionPawnCandidates = 0;
    int             stablePromotionPawnCandidates = 0;
    int             attackedPromotionPawnCandidates = 0;
    int             missingRequiredMinors = 0;
    int             immediateUnderpromotions = 0;
    int             immediateUnderpromotionPawns = 0;
    int             bishopAttackers       = 0;
    int             knightAttackers       = 0;
    bool            pureKbnk              = false;
    bool            tablebaseMaterialSeen = false;
    bool            tablebaseProbeOk      = false;
    Tablebases::WDLScore tablebaseWdl     = Tablebases::WDLDraw;
    bool            tablebaseDtzOk        = false;
    int             tablebaseDtz          = 0;
    CurrentResult   currentResult         = CurrentResult::Unknown;
    KbnPhase        kbnPhase              = KbnPhase::NotKbn;
    KbnMateVerification kbnVerification;
    ChallengeProgressVerification progressVerification;
    ChallengeProgressVerification routeVerification;
    ChallengeProgressVerification completeVerification;
};

struct OpponentReplySummary {
    int  safeSacrificeCaptures = 0;
    int  safeSacrificeCapturesReachPureKbnk = 0;
    int  unsafeSacrificeCaptureResults = 0;
    int  refusalMoves          = 0;
    bool survivorCanBeCaptured = false;
    bool requiredPawnCanBeCaptured = false;
    bool forcedSacrifice       = false;
};

struct MaterialAfterMove {
    int  unnecessaryFriendly = 0;
    int  enemyPieces         = 0;
    int  bishopAttackers     = 0;
    int  knightAttackers     = 0;
    bool hasBishop           = false;
    bool hasKnight           = false;
    bool pureKbnk            = false;
};

struct DrawRiskAfterMove {
    int  opponentLegalMoves = 0;
    bool immediateStalemate = false;
    bool immediateCheckmate = false;
    bool immediateDraw      = false;
};

struct WinPreservationAfterMove {
    bool rootScoreChecked     = false;
    bool rootScoreSafe        = false;
    bool tablebaseChecked     = false;
    bool tablebaseWinPreserved = false;
    bool pureKbnChecked       = false;
    bool pureKbnWinLikely     = false;
    bool preserved            = true;
    Tablebases::WDLScore tablebaseWdl = Tablebases::WDLDraw;
    std::string source        = "Disabled";
};

struct KbnReplySummary {
    int      legalReplies = 0;
    int      worstScore   = 0;
    Move     worstMove    = Move::none();
    KbnPhase worstPhase   = KbnPhase::NotKbn;
};

struct PromotionSafetySummary {
    int routeCandidates       = 0;
    int distinctPawns         = 0;
    int stableDistinctPawns   = 0;
    int attackedDistinctPawns = 0;
};

int count_legal_moves(const Position& pos);

std::string result_name(ChallengeResult result) {
    switch (result)
    {
    case ChallengeResult::CompleteKbnMateForceable :
        return "COMPLETE_KBN_MATE_FORCEABLE";
    case ChallengeResult::CompleteKbnMateLikely :
        return "COMPLETE_KBN_MATE_LIKELY";
    case ChallengeResult::MaterialCleanupRequired :
        return "MATERIAL_CLEANUP_REQUIRED";
    case ChallengeResult::PromotionRequiredAndForceable :
        return "PROMOTION_REQUIRED_AND_FORCEABLE";
    case ChallengeResult::OnlyPartialSacrificePlanForceable :
        return "ONLY_PARTIAL_SACRIFICE_PLAN_FORCEABLE";
    case ChallengeResult::NormalWinRequired :
        return "NORMAL_WIN_REQUIRED";
    case ChallengeResult::ChallengeImpossible :
        return "CHALLENGE_IMPOSSIBLE";
    }
    return "CHALLENGE_IMPOSSIBLE";
}

std::string proof_name(ProofLevel proof) {
    switch (proof)
    {
    case ProofLevel::ProvenByTablebase :
        return "PROVEN_BY_TABLEBASE";
    case ProofLevel::ProvenByForcedMateSearch :
        return "PROVEN_BY_FORCED_MATE_SEARCH";
    case ProofLevel::VerifiedToFixedDepth :
        return "VERIFIED_TO_FIXED_DEPTH";
    case ProofLevel::HighConfidenceHeuristic :
        return "HIGH_CONFIDENCE_HEURISTIC";
    case ProofLevel::Unproven :
        return "UNPROVEN";
    case ProofLevel::Impossible :
        return "IMPOSSIBLE";
    }
    return "IMPOSSIBLE";
}

std::string goal_name(MaterialGoal goal) {
    switch (goal)
    {
    case MaterialGoal::StabilizeWin :
        return "STABILIZE_WIN";
    case MaterialGoal::CreateMissingBishop :
        return "CREATE_MISSING_BISHOP";
    case MaterialGoal::CreateMissingKnight :
        return "CREATE_MISSING_KNIGHT";
    case MaterialGoal::SacrificeQueen :
        return "SACRIFICE_QUEEN";
    case MaterialGoal::SacrificeRooks :
        return "SACRIFICE_ROOKS";
    case MaterialGoal::SacrificeExtraMinorPieces :
        return "SACRIFICE_EXTRA_MINOR_PIECES";
    case MaterialGoal::SacrificeUnusedPawns :
        return "SACRIFICE_UNUSED_PAWNS";
    case MaterialGoal::RemoveEnemyMajorPieces :
        return "REMOVE_ENEMY_MAJOR_PIECES";
    case MaterialGoal::RemoveEnemyMinorPieces :
        return "REMOVE_ENEMY_MINOR_PIECES";
    case MaterialGoal::RemoveEnemyPawns :
        return "REMOVE_ENEMY_PAWNS";
    case MaterialGoal::EnterPureKbnEndgame :
        return "ENTER_PURE_KBN_ENDGAME";
    case MaterialGoal::DeliverKbnMate :
        return "DELIVER_KBN_MATE";
    }
    return "STABILIZE_WIN";
}

std::string current_result_name(CurrentResult result) {
    switch (result)
    {
    case CurrentResult::Winning :
        return "Winning";
    case CurrentResult::Drawing :
        return "Drawing";
    case CurrentResult::Losing :
        return "Losing";
    case CurrentResult::Unknown :
        return "Unknown";
    }
    return "Unknown";
}

std::string kbn_phase_name(KbnPhase phase) {
    switch (phase)
    {
    case KbnPhase::NotKbn :
        return "NOT_KBN";
    case KbnPhase::CentralizeKing :
        return "CENTRALIZE_KING";
    case KbnPhase::DriveToEdge :
        return "DRIVE_TO_EDGE";
    case KbnPhase::DriveFromWrongCorner :
        return "DRIVE_FROM_WRONG_CORNER";
    case KbnPhase::ForceCorrectCorner :
        return "FORCE_CORRECT_CORNER";
    case KbnPhase::TightenMateNet :
        return "TIGHTEN_MATE_NET";
    case KbnPhase::DeliverMate :
        return "DELIVER_MATE";
    }
    return "NOT_KBN";
}

std::string milestone_name(ChallengeMilestone milestone) {
    switch (milestone)
    {
    case ChallengeMilestone::None :
        return "NONE";
    case ChallengeMilestone::CreateMissingMinors :
        return "CREATE_MISSING_MINORS";
    case ChallengeMilestone::ReachPureKbnk :
        return "REACH_PURE_KBNK";
    case ChallengeMilestone::ReachVerifiedKbnMate :
        return "REACH_VERIFIED_KBN_MATE";
    }
    return "NONE";
}

std::string wdl_name(Tablebases::WDLScore wdl) {
    switch (wdl)
    {
    case Tablebases::WDLWin :
        return "WDLWin";
    case Tablebases::WDLCursedWin :
        return "WDLCursedWin";
    case Tablebases::WDLDraw :
        return "WDLDraw";
    case Tablebases::WDLBlessedLoss :
        return "WDLBlessedLoss";
    case Tablebases::WDLLoss :
        return "WDLLoss";
    }
    return "WDLDraw";
}

CurrentResult result_from_wdl(Tablebases::WDLScore wdl, bool respectFiftyMoveRule) {
    if (wdl == Tablebases::WDLWin || (!respectFiftyMoveRule && wdl == Tablebases::WDLCursedWin))
        return CurrentResult::Winning;
    if (wdl == Tablebases::WDLLoss || (!respectFiftyMoveRule && wdl == Tablebases::WDLBlessedLoss))
        return CurrentResult::Losing;
    return CurrentResult::Drawing;
}

bool light_square(Square s) {
    return ((int(file_of(s)) + int(rank_of(s))) & 1) != 0;
}

std::string square_color_name(Square s) {
    return light_square(s) ? "Light" : "Dark";
}

std::array<Square, 2> matching_corners(Square bishopSquare) {
    return light_square(bishopSquare) ? std::array<Square, 2>{SQ_A8, SQ_H1}
                                      : std::array<Square, 2>{SQ_A1, SQ_H8};
}

int count_pieces(const Position& pos, Color c, PieceType pt) {
    return popcount(pos.pieces(c, pt));
}

int non_king_count(const Position& pos, Color c) {
    return popcount(pos.pieces(c)) - count_pieces(pos, c, KING);
}

int mobility_score(const Position& pos, Color us, Square s, PieceType pt) {
    const Bitboard occupied = pos.pieces();
    const int      attacks  = popcount(attacks_bb(pt, s, occupied));
    const int      danger   = popcount(pos.attackers_to(s, occupied) & pos.pieces(~us));
    const int      center   = std::abs(int(file_of(s)) - 3) + std::abs(int(rank_of(s)) - 3);
    return attacks * 4 - danger * 10 - center;
}

PieceIdentity choose_survivor(const Position& pos, Color us, PieceType pt) {
    PieceIdentity best;
    int           bestScore = -100000;
    Bitboard      bb        = pos.pieces(us, pt);
    while (bb)
    {
        Square s     = pop_lsb(bb);
        int    score = mobility_score(pos, us, s, pt);
        if (!best.exists || score > bestScore)
        {
            best      = PieceIdentity{pt, s, true};
            bestScore = score;
        }
    }
    return best;
}

bool is_designated(PieceIdentity id, Square s) {
    return id.exists && id.square == s;
}

int designated_attackers(const Position& pos, Color us, PieceIdentity id) {
    if (!id.exists)
        return 0;
    return popcount(pos.attackers_to(id.square, pos.pieces()) & pos.pieces(~us));
}

bool required_promotion(const ChallengeState& st, Move move) {
    return move.type_of() == PROMOTION
        && ((st.bishopMustBePromoted && move.promotion_type() == BISHOP)
            || (st.knightMustBePromoted && move.promotion_type() == KNIGHT));
}

std::string piece_identity_text(const Position& pos, PieceIdentity id) {
    if (!id.exists)
        return "None";
    std::ostringstream os;
    os << "Current " << (id.type == BISHOP ? square_color_name(id.square) + "-squared bishop"
                                           : "knight")
       << " on " << UCIEngine::square(id.square);
    if (type_of(pos.piece_on(id.square)) == id.type)
        os << " (current FEN identity; original/promoted origin is not encoded in FEN)";
    return os.str();
}

int unnecessary_count(const Position& pos, Color us, PieceIdentity bishop, PieceIdentity knight) {
    int      total = 0;
    Bitboard ours  = pos.pieces(us) & ~pos.pieces(KING);
    while (ours)
    {
        Square s = pop_lsb(ours);
        if (!is_designated(bishop, s) && !is_designated(knight, s))
            ++total;
    }
    return total;
}

bool pure_kbnk(const Position& pos, Color us) {
    return count_pieces(pos, us, KING) == 1 && count_pieces(pos, us, BISHOP) == 1
        && count_pieces(pos, us, KNIGHT) == 1 && non_king_count(pos, us) == 2
        && count_pieces(pos, ~us, KING) == 1 && non_king_count(pos, ~us) == 0;
}

bool tablebase_probe(const Position& pos, Tablebases::WDLScore& wdl) {
    if (Tablebases::MaxCardinality < popcount(pos.pieces()) || pos.can_castle(ANY_CASTLING))
        return false;

    StateInfo setupState;
    Position  probePos;
    probePos.set(pos.fen(), pos.is_chess960(), &setupState);
    Tablebases::ProbeState probeState = Tablebases::FAIL;
    wdl                               = Tablebases::probe_wdl(probePos, &probeState);
    return probeState != Tablebases::FAIL;
}

bool tablebase_dtz_probe(const Position& pos, int& dtz) {
    if (Tablebases::MaxCardinality < popcount(pos.pieces()) || pos.can_castle(ANY_CASTLING))
        return false;

    StateInfo setupState;
    Position  probePos;
    probePos.set(pos.fen(), pos.is_chess960(), &setupState);
    Tablebases::ProbeState probeState = Tablebases::FAIL;
    dtz                               = Tablebases::probe_dtz(probePos, &probeState);
    return probeState != Tablebases::FAIL;
}

CurrentResult classify_current_result(const Position& pos, bool tbOk, Tablebases::WDLScore tbWdl,
                                      bool respectFiftyMoveRule) {
    const int legalMoves = count_legal_moves(pos);
    if (legalMoves == 0)
        return pos.checkers() ? CurrentResult::Losing : CurrentResult::Drawing;
    if (pos.is_draw(0))
        return CurrentResult::Drawing;
    if (tbOk)
        return result_from_wdl(tbWdl, respectFiftyMoveRule);
    return CurrentResult::Unknown;
}

bool clear_forward_promotion_lane(const Position& pos, Color us, Square pawnSquare) {
    Square s = pawnSquare;
    while (relative_rank(us, s) != RANK_8)
    {
        s += pawn_push(us);
        if (!is_ok(s) || !pos.empty(s))
            return false;
    }
    return true;
}

PromotionSafetySummary promotion_safety(const Position& pos, Color us, bool needBishop,
                                        bool needKnight) {
    PromotionSafetySummary summary;
    if (!needBishop && !needKnight)
        return summary;

    Bitboard pawns = pos.pieces(us, PAWN);
    while (pawns)
    {
        Square pawn = pop_lsb(pawns);
        if (!clear_forward_promotion_lane(pos, us, pawn))
            continue;

        summary.routeCandidates += int(needBishop) + int(needKnight);
        ++summary.distinctPawns;

        const bool attacked = bool(pos.attackers_to(pawn, pos.pieces()) & pos.pieces(~us));
        if (attacked)
            ++summary.attackedDistinctPawns;
        else
            ++summary.stableDistinctPawns;
    }
    return summary;
}

int immediate_required_underpromotions(const Position& pos, const ChallengeState& st) {
    if (!st.bishopMustBePromoted && !st.knightMustBePromoted)
        return 0;

    int count = 0;
    for (const auto& move : MoveList<LEGAL>(pos))
        if (required_promotion(st, move))
            ++count;
    return count;
}

int immediate_required_underpromotion_pawns(const Position& pos, const ChallengeState& st) {
    if (!st.bishopMustBePromoted && !st.knightMustBePromoted)
        return 0;

    std::array<bool, 64> seen{};
    int                  count = 0;
    for (const auto& move : MoveList<LEGAL>(pos))
    {
        if (!required_promotion(st, move))
            continue;
        const int from = int(move.from_sq());
        if (!seen[from])
        {
            seen[from] = true;
            ++count;
        }
    }
    return count;
}

bool needs_promotion_piece(const ChallengeState& st) {
    return st.bishopMustBePromoted || st.knightMustBePromoted;
}

int promotion_progress_score(const Position& pos, Move move, Color us, const ChallengeState& st) {
    if (!needs_promotion_piece(st) || !bool(move))
        return 0;

    const Piece moved = pos.piece_on(move.from_sq());
    if (moved == NO_PIECE || color_of(moved) != us || type_of(moved) != PAWN)
        return 0;

    if (required_promotion(st, move))
        return 1400;

    if (move.type_of() == PROMOTION)
        return -900;

    const int beforeDistance = 7 - int(relative_rank(us, move.from_sq()));
    const int afterDistance  = 7 - int(relative_rank(us, move.to_sq()));
    int       score          = (beforeDistance - afterDistance) * 180;

    StateInfo setupState;
    StateInfo moveState;
    Position  next;
    next.set(pos.fen(), pos.is_chess960(), &setupState);
    next.do_move(move, moveState);

    if (clear_forward_promotion_lane(next, us, move.to_sq()))
        score += 220;
    if (int(relative_rank(us, move.to_sq())) >= int(RANK_6))
        score += 120;
    if (pos.attackers_to(move.to_sq(), pos.pieces()) & pos.pieces(~us))
        score -= 160;

    const PromotionSafetySummary afterPromotion =
      promotion_safety(next, us, st.bishopMustBePromoted, st.knightMustBePromoted);
    score += (afterPromotion.stableDistinctPawns - st.stablePromotionPawnCandidates) * 260;
    score -= (afterPromotion.attackedDistinctPawns - st.attackedPromotionPawnCandidates) * 120;
    return score;
}

int count_legal_moves(const Position& pos) {
    int legalMoves = 0;
    for (const auto& m : MoveList<LEGAL>(pos))
    {
        (void) m;
        ++legalMoves;
    }
    return legalMoves;
}

int edge_distance(Square s) {
    const int f = int(file_of(s));
    const int r = int(rank_of(s));
    return std::min({f, 7 - f, r, 7 - r});
}

int kbn_static_geometry_score(const Position& pos, Color us, const ChallengeState& st) {
    if (!pure_kbnk(pos, us) || st.cornerA == SQ_NONE || st.cornerB == SQ_NONE)
        return 0;

    const Square attackerKing = pos.square<KING>(us);
    const Square defenderKing = pos.square<KING>(~us);
    const Square bishop       = lsb(pos.pieces(us, BISHOP));
    const Square knight       = lsb(pos.pieces(us, KNIGHT));

    const int targetDistance =
      std::min(int(SquareDistance[defenderKing][st.cornerA]), int(SquareDistance[defenderKing][st.cornerB]));

    const std::array<Square, 4> corners{SQ_A1, SQ_H1, SQ_A8, SQ_H8};
    int                         wrongCornerDistance = 8;
    for (Square corner : corners)
        if (corner != st.cornerA && corner != st.cornerB)
            wrongCornerDistance =
              std::min(wrongCornerDistance, int(SquareDistance[defenderKing][corner]));

    const int      kingDistance = int(SquareDistance[attackerKing][defenderKing]);
    const int      edgePressure = 3 - edge_distance(defenderKing);
    const Bitboard occupied     = pos.pieces();
    const Bitboard defenderRing = attacks_bb<KING>(defenderKing);
    const Bitboard controlledRing = defenderRing
                                  & (attacks_bb<KING>(attackerKing)
                                     | attacks_bb<KNIGHT>(knight)
                                     | attacks_bb<BISHOP>(bishop, occupied));
    const Bitboard safeFlights = defenderRing & ~pos.pieces(us)
                               & ~(attacks_bb<KING>(attackerKing)
                                  | attacks_bb<KNIGHT>(knight)
                                  | attacks_bb<BISHOP>(bishop, occupied));

    int score = 0;
    score += (7 - targetDistance) * 180;
    score -= std::max(0, 4 - wrongCornerDistance) * 240;
    score += edgePressure * 150;
    score += (7 - kingDistance) * 55;
    score += popcount(controlledRing) * 85;
    score -= popcount(safeFlights) * 70;
    if (pos.rule50_count() >= 80)
        score -= (pos.rule50_count() - 79) * 45;
    return score;
}

KbnPhase classify_kbn_phase(const Position& pos, Color us, const ChallengeState& st) {
    if (!pure_kbnk(pos, us) || st.cornerA == SQ_NONE || st.cornerB == SQ_NONE)
        return KbnPhase::NotKbn;

    if (pos.side_to_move() == ~us && count_legal_moves(pos) == 0)
        return pos.checkers() ? KbnPhase::DeliverMate : KbnPhase::TightenMateNet;

    const Square attackerKing = pos.square<KING>(us);
    const Square defenderKing = pos.square<KING>(~us);
    const Square bishop       = lsb(pos.pieces(us, BISHOP));
    const Square knight       = lsb(pos.pieces(us, KNIGHT));

    const int targetDistance =
      std::min(int(SquareDistance[defenderKing][st.cornerA]), int(SquareDistance[defenderKing][st.cornerB]));

    const std::array<Square, 4> corners{SQ_A1, SQ_H1, SQ_A8, SQ_H8};
    int                         wrongCornerDistance = 8;
    for (Square corner : corners)
        if (corner != st.cornerA && corner != st.cornerB)
            wrongCornerDistance =
              std::min(wrongCornerDistance, int(SquareDistance[defenderKing][corner]));

    const int      defenderEdgeDistance = edge_distance(defenderKing);
    const int      kingDistance         = int(SquareDistance[attackerKing][defenderKing]);
    const Bitboard occupied             = pos.pieces();
    const Bitboard controlled           = attacks_bb<KING>(attackerKing)
                              | attacks_bb<KNIGHT>(knight)
                              | attacks_bb<BISHOP>(bishop, occupied);
    const Bitboard safeFlights          = attacks_bb<KING>(defenderKing) & ~pos.pieces(us) & ~controlled;
    const int      safeFlightCount      = popcount(safeFlights);

    if (targetDistance <= 1 && safeFlightCount <= 1)
        return KbnPhase::TightenMateNet;
    if (defenderEdgeDistance > 1)
        return kingDistance >= 4 ? KbnPhase::CentralizeKing : KbnPhase::DriveToEdge;
    if (wrongCornerDistance <= 2 && wrongCornerDistance < targetDistance)
        return KbnPhase::DriveFromWrongCorner;
    if (targetDistance > 2)
        return KbnPhase::ForceCorrectCorner;
    return KbnPhase::TightenMateNet;
}

int kbn_phase_score(const Position& pos, Color us, const ChallengeState& st) {
    if (!pure_kbnk(pos, us))
        return 0;

    const int defenderMoves = count_legal_moves(pos);
    if (defenderMoves == 0)
        return pos.checkers() ? 50000 : -50000;

    const Square attackerKing = pos.square<KING>(us);
    const Square defenderKing = pos.square<KING>(~us);
    const Square bishop       = lsb(pos.pieces(us, BISHOP));
    const Square knight       = lsb(pos.pieces(us, KNIGHT));

    const int targetDistance =
      std::min(int(SquareDistance[defenderKing][st.cornerA]), int(SquareDistance[defenderKing][st.cornerB]));

    const std::array<Square, 4> corners{SQ_A1, SQ_H1, SQ_A8, SQ_H8};
    int                         wrongCornerDistance = 8;
    for (Square corner : corners)
        if (corner != st.cornerA && corner != st.cornerB)
            wrongCornerDistance =
              std::min(wrongCornerDistance, int(SquareDistance[defenderKing][corner]));

    const int kingDistance = int(SquareDistance[attackerKing][defenderKing]);
    const int edgePressure = 3 - edge_distance(defenderKing);

    const Bitboard occupied       = pos.pieces();
    const Bitboard defenderRing   = attacks_bb<KING>(defenderKing);
    const Bitboard controlledRing = defenderRing
                                  & (attacks_bb<KING>(attackerKing)
                                     | attacks_bb<KNIGHT>(knight)
                                     | attacks_bb<BISHOP>(bishop, occupied));

    int score = 0;
    score += (7 - targetDistance) * 150;          // drive toward a bishop-colored corner
    score -= std::max(0, 4 - wrongCornerDistance) * 180;
    score += edgePressure * 100;                  // first force the defending king to the edge
    score += (7 - kingDistance) * 45;             // attacking king must take opposition
    score += popcount(controlledRing) * 55;       // reduce the king's flight squares
    score -= defenderMoves * 18;                  // prefer tighter boxes
    switch (classify_kbn_phase(pos, us, st))
    {
    case KbnPhase::CentralizeKing :
        score += (7 - kingDistance) * 60;
        break;
    case KbnPhase::DriveToEdge :
        score += edgePressure * 120;
        break;
    case KbnPhase::DriveFromWrongCorner :
        score -= std::max(0, 4 - wrongCornerDistance) * 220;
        break;
    case KbnPhase::ForceCorrectCorner :
        score += (7 - targetDistance) * 90;
        break;
    case KbnPhase::TightenMateNet :
        score += popcount(controlledRing) * 80 - defenderMoves * 25;
        break;
    case KbnPhase::DeliverMate :
        score += 10000;
        break;
    case KbnPhase::NotKbn :
        break;
    }
    if (kingDistance <= 1)
        score -= 1000;                            // should be impossible legally, but avoid bad geometry
    if (pos.rule50_count() >= 80)
        score -= (pos.rule50_count() - 79) * 45;
    return score;
}

int kbn_after_move_score(const Position& pos, Move move, Color us, const ChallengeState& st) {
    StateInfo setupState;
    StateInfo moveState;
    Position  next;
    next.set(pos.fen(), pos.is_chess960(), &setupState);
    next.do_move(move, moveState);
    return kbn_phase_score(next, us, st);
}

KbnReplySummary kbn_worst_reply_after_move(const Position& pos, Move move, Color us,
                                           const ChallengeState& st) {
    KbnReplySummary summary;
    StateInfo       setupState;
    StateInfo       moveState;
    Position        next;
    next.set(pos.fen(), pos.is_chess960(), &setupState);
    next.do_move(move, moveState);

    if (!pure_kbnk(next, us))
        return summary;

    summary.worstScore = std::numeric_limits<int>::max();
    for (const auto& reply : MoveList<LEGAL>(next))
    {
        ++summary.legalReplies;

        StateInfo replySetupState;
        StateInfo replyState;
        Position  replyPos;
        replyPos.set(next.fen(), next.is_chess960(), &replySetupState);
        replyPos.do_move(reply, replyState);

        const int      score = kbn_static_geometry_score(replyPos, us, st);
        const KbnPhase phase = classify_kbn_phase(replyPos, us, st);
        if (summary.worstMove == Move::none() || score < summary.worstScore)
        {
            summary.worstScore = score;
            summary.worstMove  = reply;
            summary.worstPhase = phase;
        }
    }

    if (summary.legalReplies == 0)
    {
        summary.worstScore = next.checkers() ? 50000 : -50000;
        summary.worstPhase = next.checkers() ? KbnPhase::DeliverMate : KbnPhase::TightenMateNet;
    }
    return summary;
}

uint64_t kbn_verify_cache_key(const Position& pos, int depth) {
    return pos.key() ^ (uint64_t(depth + 128) * 0x9E3779B97F4A7C15ULL);
}

int forced_kbn_mate_plies(const Position& pos, Color attacker, int depth, int& nodes,
                          int nodeLimit, bool& truncated,
                          std::unordered_map<uint64_t, int>& cache,
                          int& cacheHits) {
    if (++nodes > nodeLimit)
    {
        truncated = true;
        return -1;
    }

    const uint64_t cacheKey = kbn_verify_cache_key(pos, depth);
    auto           cached   = cache.find(cacheKey);
    if (cached != cache.end())
    {
        ++cacheHits;
        return cached->second;
    }

    int legalMoves = 0;
    int result     = -1;
    if (pos.side_to_move() == attacker)
    {
        int best = std::numeric_limits<int>::max();
        for (const auto& move : MoveList<LEGAL>(pos))
        {
            ++legalMoves;
            if (depth <= 0)
                continue;

            StateInfo setupState;
            StateInfo moveState;
            Position  next;
            next.set(pos.fen(), pos.is_chess960(), &setupState);
            next.do_move(move, moveState);

            int mate = forced_kbn_mate_plies(next, attacker, depth - 1, nodes, nodeLimit, truncated,
                                             cache, cacheHits);
            if (mate >= 0)
                best = std::min(best, mate + 1);
        }
        result = legalMoves == 0 || best == std::numeric_limits<int>::max() ? -1 : best;
        cache.emplace(cacheKey, result);
        return result;
    }

    int worst = 0;
    for (const auto& move : MoveList<LEGAL>(pos))
    {
        ++legalMoves;
        if (depth <= 0)
            return -1;

        StateInfo setupState;
        StateInfo moveState;
        Position  next;
        next.set(pos.fen(), pos.is_chess960(), &setupState);
        next.do_move(move, moveState);

        int mate = forced_kbn_mate_plies(next, attacker, depth - 1, nodes, nodeLimit, truncated,
                                         cache, cacheHits);
        if (mate < 0)
        {
            cache.emplace(cacheKey, -1);
            return -1;
        }
        worst = std::max(worst, mate + 1);
    }

    if (legalMoves == 0)
        result = pos.checkers() ? 0 : -1;
    else
        result = worst;
    cache.emplace(cacheKey, result);
    return result;
}

KbnMateVerification verify_kbn_mate_to_depth(const Position& pos, Color attacker, int depth) {
    KbnMateVerification summary;
    summary.attempted = true;
    summary.depth     = depth;

    if (!pure_kbnk(pos, attacker))
        return summary;

    const int nodeLimit = std::clamp(depth * 10000, 10000, 250000);
    int       nodes     = 0;
    int       cacheHits = 0;
    bool      truncated = false;
    std::unordered_map<uint64_t, int> cache;
    int matePly =
      forced_kbn_mate_plies(pos, attacker, depth, nodes, nodeLimit, truncated, cache, cacheHits);

    summary.nodes      = nodes;
    summary.cacheHits  = cacheHits;
    summary.truncated  = truncated;
    summary.forcedMate = matePly >= 0;
    summary.matePly    = matePly >= 0 ? matePly : 0;
    return summary;
}

struct ProgressVerifyContext {
    Color              attacker       = WHITE;
    bool               needBishop     = false;
    bool               needKnight     = false;
    ChallengeMilestone target         = ChallengeMilestone::None;
    bool               respectFifty   = true;
    int                kbnMateDepth   = 0;
    int                nodeLimit      = 50000;
    bool               truncated      = false;
    int                nodes          = 0;
    int                cacheHits      = 0;
    std::unordered_map<uint64_t, bool> cache;
    std::unordered_map<uint64_t, bool> kbnMateCache;
};

CurrentResult result_for_attacker_from_tablebase(Tablebases::WDLScore wdl, Color sideToMove,
                                                 Color attacker, bool respectFiftyMoveRule) {
    CurrentResult sideResult = result_from_wdl(wdl, respectFiftyMoveRule);
    if (sideToMove == attacker)
        return sideResult;
    if (sideResult == CurrentResult::Winning)
        return CurrentResult::Losing;
    if (sideResult == CurrentResult::Losing)
        return CurrentResult::Winning;
    return sideResult;
}

CurrentResult local_result_for_attacker(const Position& pos, Color attacker,
                                        bool respectFiftyMoveRule) {
    const int legalMoves = count_legal_moves(pos);
    if (legalMoves == 0)
    {
        if (!pos.checkers())
            return CurrentResult::Drawing;
        return pos.side_to_move() == attacker ? CurrentResult::Losing : CurrentResult::Winning;
    }
    if (pos.is_draw(0))
        return CurrentResult::Drawing;

    Tablebases::WDLScore wdl = Tablebases::WDLDraw;
    if (tablebase_probe(pos, wdl))
        return result_for_attacker_from_tablebase(wdl, pos.side_to_move(), attacker,
                                                  respectFiftyMoveRule);
    return CurrentResult::Unknown;
}

bool progress_required_material_alive(const Position& pos, const ProgressVerifyContext& ctx) {
    if (!ctx.needBishop && count_pieces(pos, ctx.attacker, BISHOP) == 0)
        return false;
    if (!ctx.needKnight && count_pieces(pos, ctx.attacker, KNIGHT) == 0)
        return false;
    if (count_pieces(pos, ctx.attacker, KING) != 1)
        return false;
    return true;
}

bool kbn_mate_target_reached(const Position& pos, ProgressVerifyContext& ctx) {
    if (!pure_kbnk(pos, ctx.attacker) || ctx.kbnMateDepth <= 0)
        return false;

    const uint64_t key = pos.key() ^ (uint64_t(ctx.kbnMateDepth + 4096) * 0xA24BAED4963EE407ULL);
    auto           it  = ctx.kbnMateCache.find(key);
    if (it != ctx.kbnMateCache.end())
    {
        ++ctx.cacheHits;
        return it->second;
    }

    Tablebases::WDLScore wdl = Tablebases::WDLDraw;
    if (tablebase_probe(pos, wdl)
        && result_for_attacker_from_tablebase(wdl, pos.side_to_move(), ctx.attacker,
                                              ctx.respectFifty)
             == CurrentResult::Winning)
    {
        ctx.kbnMateCache.emplace(key, true);
        return true;
    }

    KbnMateVerification proof = verify_kbn_mate_to_depth(pos, ctx.attacker, ctx.kbnMateDepth);
    if (proof.truncated)
        ctx.truncated = true;
    ctx.nodes += proof.nodes;
    ctx.cacheHits += proof.cacheHits;
    ctx.kbnMateCache.emplace(key, proof.forcedMate);
    return proof.forcedMate;
}

bool progress_target_reached(const Position& pos, ProgressVerifyContext& ctx) {
    if (ctx.target == ChallengeMilestone::CreateMissingMinors)
    {
        const bool bishopOk = !ctx.needBishop || count_pieces(pos, ctx.attacker, BISHOP) > 0;
        const bool knightOk = !ctx.needKnight || count_pieces(pos, ctx.attacker, KNIGHT) > 0;
        return bishopOk && knightOk && progress_required_material_alive(pos, ctx);
    }
    if (ctx.target == ChallengeMilestone::ReachPureKbnk)
        return pure_kbnk(pos, ctx.attacker);
    if (ctx.target == ChallengeMilestone::ReachVerifiedKbnMate)
        return kbn_mate_target_reached(pos, ctx);
    return false;
}

uint64_t progress_verify_cache_key(const Position& pos, int depth) {
    return pos.key() ^ (uint64_t(depth + 257) * 0xD6E8FEB86659FD93ULL);
}

bool can_force_challenge_progress(const Position& pos, int depth, ProgressVerifyContext& ctx) {
    if (++ctx.nodes > ctx.nodeLimit)
    {
        ctx.truncated = true;
        return false;
    }

    if (progress_target_reached(pos, ctx))
        return true;
    if (depth <= 0 || !progress_required_material_alive(pos, ctx))
        return false;

    const CurrentResult result = local_result_for_attacker(pos, ctx.attacker, ctx.respectFifty);
    if (result == CurrentResult::Losing || result == CurrentResult::Drawing)
        return false;

    const uint64_t key = progress_verify_cache_key(pos, depth);
    auto           it  = ctx.cache.find(key);
    if (it != ctx.cache.end())
    {
        ++ctx.cacheHits;
        return it->second;
    }

    int  legalMoves = 0;
    bool forceable  = pos.side_to_move() == ctx.attacker ? false : true;
    for (const auto& move : MoveList<LEGAL>(pos))
    {
        ++legalMoves;
        StateInfo setupState;
        StateInfo moveState;
        Position  next;
        next.set(pos.fen(), pos.is_chess960(), &setupState);
        next.do_move(move, moveState);

        const bool child = can_force_challenge_progress(next, depth - 1, ctx);
        if (pos.side_to_move() == ctx.attacker)
        {
            if (child)
            {
                forceable = true;
                break;
            }
        }
        else if (!child)
        {
            forceable = false;
            break;
        }
    }

    if (legalMoves == 0)
        forceable = false;
    ctx.cache.emplace(key, forceable);
    return forceable;
}

ChallengeProgressVerification verify_challenge_progress_to_depth(const Position& pos,
                                                                 const ChallengeState& st,
                                                                 int depth,
                                                                 ChallengeMilestone target,
                                                                 int kbnMateDepth,
                                                                 const OptionsMap& options) {
    ChallengeProgressVerification summary;
    summary.attempted = true;
    summary.depth     = depth;
    summary.target    = target == ChallengeMilestone::None
                       ? (st.missingRequiredMinors > 0 ? ChallengeMilestone::CreateMissingMinors
                                                       : ChallengeMilestone::ReachPureKbnk)
                       : target;

    if (st.currentResult == CurrentResult::Losing || st.currentResult == CurrentResult::Drawing
        || st.pureKbnk || summary.target == ChallengeMilestone::None)
        return summary;

    ProgressVerifyContext ctx;
    ctx.attacker     = pos.side_to_move();
    ctx.needBishop   = st.bishopMustBePromoted;
    ctx.needKnight   = st.knightMustBePromoted;
    ctx.target       = summary.target;
    ctx.respectFifty = bool(options["RespectFiftyMoveRule"]);
    ctx.kbnMateDepth = kbnMateDepth;
    ctx.nodeLimit    = std::clamp(depth * 20000, 20000, 300000);

    if (pos.side_to_move() == ctx.attacker)
    {
        for (const auto& move : MoveList<LEGAL>(pos))
        {
            StateInfo setupState;
            StateInfo moveState;
            Position  next;
            next.set(pos.fen(), pos.is_chess960(), &setupState);
            next.do_move(move, moveState);
            if (can_force_challenge_progress(next, depth - 1, ctx))
            {
                summary.forceable = true;
                summary.firstMove = move;
                break;
            }
            if (ctx.truncated)
                break;
        }
    }
    else
        summary.forceable = can_force_challenge_progress(pos, depth, ctx);

    summary.nodes     = ctx.nodes;
    summary.cacheHits = ctx.cacheHits;
    summary.truncated = ctx.truncated;
    return summary;
}

bool original_or_created_survivor(const Position& before, Move candidate, const ChallengeState& st,
                                  Square s) {
    if (st.bishop.exists)
    {
        Square bishop = candidate.from_sq() == st.bishop.square ? candidate.to_sq() : st.bishop.square;
        if (s == bishop)
            return true;
    }
    if (st.knight.exists)
    {
        Square knight = candidate.from_sq() == st.knight.square ? candidate.to_sq() : st.knight.square;
        if (s == knight)
            return true;
    }
    if (required_promotion(st, candidate) && s == candidate.to_sq())
        return true;

    // If the side already owns only one of a required minor, keep that minor alive
    // even if the position identity came from a FEN rather than game history.
    const Color us = before.side_to_move();
    if (!st.bishopMustBePromoted && count_pieces(before, us, BISHOP) == 1
        && type_of(before.piece_on(s)) == BISHOP && color_of(before.piece_on(s)) == us)
        return true;
    if (!st.knightMustBePromoted && count_pieces(before, us, KNIGHT) == 1
        && type_of(before.piece_on(s)) == KNIGHT && color_of(before.piece_on(s)) == us)
        return true;

    return false;
}

bool survivor_after_move(const Position& before, Move candidate, const ChallengeState& st, Square s) {
    if (st.bishop.exists)
    {
        Square bishop = candidate.from_sq() == st.bishop.square ? candidate.to_sq() : st.bishop.square;
        if (s == bishop)
            return true;
    }
    if (st.knight.exists)
    {
        Square knight = candidate.from_sq() == st.knight.square ? candidate.to_sq() : st.knight.square;
        if (s == knight)
            return true;
    }
    if (required_promotion(st, candidate) && s == candidate.to_sq())
        return true;

    const Color us = before.side_to_move();
    if (!st.bishopMustBePromoted && count_pieces(before, us, BISHOP) == 1)
    {
        Bitboard bishop = before.pieces(us, BISHOP);
        if (bishop && s == (candidate.from_sq() == lsb(bishop) ? candidate.to_sq() : lsb(bishop)))
            return true;
    }
    if (!st.knightMustBePromoted && count_pieces(before, us, KNIGHT) == 1)
    {
        Bitboard knight = before.pieces(us, KNIGHT);
        if (knight && s == (candidate.from_sq() == lsb(knight) ? candidate.to_sq() : lsb(knight)))
            return true;
    }
    return false;
}

Square survivor_square_after_move(const Position& before, const Position& after, Move candidate,
                                  const ChallengeState& st, PieceType pt) {
    const Color us = before.side_to_move();
    Square      s  = SQ_NONE;

    if (pt == BISHOP && st.bishop.exists)
        s = candidate.from_sq() == st.bishop.square ? candidate.to_sq() : st.bishop.square;
    else if (pt == KNIGHT && st.knight.exists)
        s = candidate.from_sq() == st.knight.square ? candidate.to_sq() : st.knight.square;
    else if (candidate.type_of() == PROMOTION && candidate.promotion_type() == pt
             && ((pt == BISHOP && st.bishopMustBePromoted)
                 || (pt == KNIGHT && st.knightMustBePromoted)))
        s = candidate.to_sq();
    else if (pt == BISHOP && !st.bishopMustBePromoted && count_pieces(before, us, BISHOP) == 1)
    {
        Square old = lsb(before.pieces(us, BISHOP));
        s          = candidate.from_sq() == old ? candidate.to_sq() : old;
    }
    else if (pt == KNIGHT && !st.knightMustBePromoted && count_pieces(before, us, KNIGHT) == 1)
    {
        Square old = lsb(before.pieces(us, KNIGHT));
        s          = candidate.from_sq() == old ? candidate.to_sq() : old;
    }

    if (s == SQ_NONE || !is_ok(s))
        return SQ_NONE;
    Piece piece = after.piece_on(s);
    return piece != NO_PIECE && color_of(piece) == us && type_of(piece) == pt ? s : SQ_NONE;
}

MaterialAfterMove material_after_move(const Position& pos, Move move, const ChallengeState& st) {
    MaterialAfterMove summary;
    StateInfo         setupState;
    StateInfo         moveState;
    Position          next;
    next.set(pos.fen(), pos.is_chess960(), &setupState);
    next.do_move(move, moveState);

    const Color us = pos.side_to_move();
    summary.enemyPieces = non_king_count(next, ~us);
    summary.hasBishop   = count_pieces(next, us, BISHOP) > 0;
    summary.hasKnight   = count_pieces(next, us, KNIGHT) > 0;

    Square bishop = survivor_square_after_move(pos, next, move, st, BISHOP);
    Square knight = survivor_square_after_move(pos, next, move, st, KNIGHT);
    if (bishop != SQ_NONE)
        summary.bishopAttackers = popcount(next.attackers_to(bishop, next.pieces()) & next.pieces(~us));
    if (knight != SQ_NONE)
        summary.knightAttackers = popcount(next.attackers_to(knight, next.pieces()) & next.pieces(~us));

    Bitboard ours = next.pieces(us) & ~next.pieces(KING);
    while (ours)
    {
        Square s = pop_lsb(ours);
        if (!survivor_after_move(pos, move, st, s))
            ++summary.unnecessaryFriendly;
    }

    summary.pureKbnk = count_pieces(next, us, KING) == 1 && count_pieces(next, us, BISHOP) == 1
                    && count_pieces(next, us, KNIGHT) == 1 && non_king_count(next, us) == 2
                    && count_pieces(next, ~us, KING) == 1 && non_king_count(next, ~us) == 0;
    return summary;
}

DrawRiskAfterMove draw_risk_after_move(const Position& pos, Move move) {
    DrawRiskAfterMove summary;
    StateInfo         setupState;
    StateInfo         moveState;
    Position          next;
    next.set(pos.fen(), pos.is_chess960(), &setupState);
    next.do_move(move, moveState);

    summary.opponentLegalMoves = count_legal_moves(next);
    summary.immediateStalemate = summary.opponentLegalMoves == 0 && !next.checkers();
    summary.immediateCheckmate = summary.opponentLegalMoves == 0 && bool(next.checkers());
    summary.immediateDraw      = summary.immediateStalemate || next.is_draw(1);
    return summary;
}

int material_progress_score(const ChallengeState& st, const MaterialAfterMove& after) {
    int score = 0;

    score += (st.unnecessaryFriendly - after.unnecessaryFriendly) * 260;
    score += (st.enemyPieces - after.enemyPieces) * 160;

    if (st.bishopMustBePromoted && after.hasBishop)
        score += 600;
    if (st.knightMustBePromoted && after.hasKnight)
        score += 600;
    if (!st.pureKbnk && after.pureKbnk)
        score += 1200;

    score += (st.bishopAttackers - after.bishopAttackers) * 180;
    score += (st.knightAttackers - after.knightAttackers) * 180;
    score -= (after.bishopAttackers + after.knightAttackers) * 90;

    if (after.unnecessaryFriendly > st.unnecessaryFriendly)
        score -= (after.unnecessaryFriendly - st.unnecessaryFriendly) * 220;
    if (after.enemyPieces > st.enemyPieces)
        score -= (after.enemyPieces - st.enemyPieces) * 120;
    return score;
}

OpponentReplySummary summarize_replies_after(const Position& pos, Move candidate,
                                             const ChallengeState& st) {
    OpponentReplySummary summary;
    StateInfo            setupState;
    StateInfo            candidateState;
    Position             next;
    next.set(pos.fen(), pos.is_chess960(), &setupState);
    next.do_move(candidate, candidateState);

    const Color us = pos.side_to_move();
    int         legalReplies = 0;

    for (const auto& reply : MoveList<LEGAL>(next))
    {
        ++legalReplies;
        bool replyCaptures = next.capture(reply);
        bool safeSacrifice = false;
        if (replyCaptures)
        {
            Square capturedSquare = reply.type_of() == EN_PASSANT ? Square(reply.to_sq() + pawn_push(us))
                                                                   : reply.to_sq();
            Piece captured = next.piece_on(capturedSquare);
            if (captured != NO_PIECE && color_of(captured) == us)
            {
                if (original_or_created_survivor(pos, candidate, st, capturedSquare))
                    summary.survivorCanBeCaptured = true;
                else if (needs_promotion_piece(st) && type_of(captured) == PAWN)
                    summary.requiredPawnCanBeCaptured = true;
                else
                    safeSacrifice = true;
            }
        }

        if (safeSacrifice)
        {
            ++summary.safeSacrificeCaptures;
            StateInfo replySetupState;
            StateInfo replyState;
            Position  afterReply;
            afterReply.set(next.fen(), next.is_chess960(), &replySetupState);
            afterReply.do_move(reply, replyState);
            if (pure_kbnk(afterReply, us) && !afterReply.is_draw(1))
                ++summary.safeSacrificeCapturesReachPureKbnk;
            else
                ++summary.unsafeSacrificeCaptureResults;
        }
        else
            ++summary.refusalMoves;
    }

    summary.forcedSacrifice = legalReplies > 0 && summary.safeSacrificeCaptures > 0
                            && summary.refusalMoves == 0 && !summary.survivorCanBeCaptured;
    return summary;
}

MaterialGoal next_goal(const Position& pos, Color us, const ChallengeState& st) {
    if (st.pureKbnk)
        return MaterialGoal::DeliverKbnMate;
    if (st.bishopMustBePromoted)
        return MaterialGoal::CreateMissingBishop;
    if (st.knightMustBePromoted)
        return MaterialGoal::CreateMissingKnight;
    for (PieceType pt : {QUEEN, ROOK, BISHOP, KNIGHT, PAWN})
    {
        Bitboard bb = pos.pieces(us, pt);
        while (bb)
        {
            Square s = pop_lsb(bb);
            if (is_designated(st.bishop, s) || is_designated(st.knight, s))
                continue;
            if (pt == QUEEN)
                return MaterialGoal::SacrificeQueen;
            if (pt == ROOK)
                return MaterialGoal::SacrificeRooks;
            if (pt == BISHOP || pt == KNIGHT)
                return MaterialGoal::SacrificeExtraMinorPieces;
            if (pt == PAWN)
                return MaterialGoal::SacrificeUnusedPawns;
        }
    }
    if (pos.pieces(~us, QUEEN, ROOK))
        return MaterialGoal::RemoveEnemyMajorPieces;
    if (pos.pieces(~us, BISHOP, KNIGHT))
        return MaterialGoal::RemoveEnemyMinorPieces;
    if (pos.pieces(~us, PAWN))
        return MaterialGoal::RemoveEnemyPawns;
    return MaterialGoal::EnterPureKbnEndgame;
}

ChallengeState analyze(const Position& pos, const OptionsMap& options) {
    ChallengeState st;
    Color          us = pos.side_to_move();
    st.bishop         = choose_survivor(pos, us, BISHOP);
    st.knight         = choose_survivor(pos, us, KNIGHT);
    st.bishopAttackers = designated_attackers(pos, us, st.bishop);
    st.knightAttackers = designated_attackers(pos, us, st.knight);
    st.bishopMustBePromoted = !st.bishop.exists;
    st.knightMustBePromoted = !st.knight.exists;
    st.unnecessaryFriendly  = unnecessary_count(pos, us, st.bishop, st.knight);
    st.enemyPieces          = non_king_count(pos, ~us);
    st.pureKbnk             = pure_kbnk(pos, us);
    st.tablebaseProbeOk     = tablebase_probe(pos, st.tablebaseWdl);
    st.tablebaseDtzOk       = st.tablebaseProbeOk && tablebase_dtz_probe(pos, st.tablebaseDtz);
    st.tablebaseMaterialSeen = st.tablebaseProbeOk;
    st.currentResult        = classify_current_result(pos, st.tablebaseProbeOk, st.tablebaseWdl,
                                                      bool(options["RespectFiftyMoveRule"]));
    const PromotionSafetySummary promotion =
      promotion_safety(pos, us, st.bishopMustBePromoted, st.knightMustBePromoted);
    st.promotionCandidates             = promotion.routeCandidates;
    st.promotionPawnCandidates         = promotion.distinctPawns;
    st.stablePromotionPawnCandidates   = promotion.stableDistinctPawns;
    st.attackedPromotionPawnCandidates = promotion.attackedDistinctPawns;
    st.missingRequiredMinors = int(st.bishopMustBePromoted) + int(st.knightMustBePromoted);
    st.immediateUnderpromotions = immediate_required_underpromotions(pos, st);
    st.immediateUnderpromotionPawns = immediate_required_underpromotion_pawns(pos, st);
    if (st.bishop.exists)
    {
        auto corners = matching_corners(st.bishop.square);
        st.cornerA   = corners[0];
        st.cornerB   = corners[1];
    }
    st.kbnPhase = classify_kbn_phase(pos, us, st);
    if (st.pureKbnk)
    {
        st.kbnVerification =
          verify_kbn_mate_to_depth(pos, us, std::clamp(int(options["KBNVerificationDepth"]), 1, 64));
        st.completeVerification.attempted = true;
        st.completeVerification.forceable = st.kbnVerification.forcedMate
                                         || (st.tablebaseProbeOk
                                             && result_from_wdl(st.tablebaseWdl,
                                                                bool(options["RespectFiftyMoveRule"]))
                                                  == CurrentResult::Winning);
        st.completeVerification.truncated = st.kbnVerification.truncated;
        st.completeVerification.target    = ChallengeMilestone::ReachVerifiedKbnMate;
        st.completeVerification.depth     = 0;
        st.completeVerification.nodes     = st.kbnVerification.nodes;
        st.completeVerification.cacheHits = st.kbnVerification.cacheHits;
    }
    else
    {
        const int challengeDepth = std::clamp(int(options["ChallengeVerificationDepth"]), 1, 16);
        const int kbnMateDepth   = std::clamp(int(options["KBNVerificationDepth"]), 1, 64);
        const int completeKbnDepth = std::clamp(int(options["CompleteKBNVerificationDepth"]), 1, 64);
        st.progressVerification = verify_challenge_progress_to_depth(
          pos, st, challengeDepth, ChallengeMilestone::None, kbnMateDepth, options);
        st.routeVerification =
          st.progressVerification.target == ChallengeMilestone::ReachPureKbnk
            ? st.progressVerification
            : verify_challenge_progress_to_depth(pos, st, challengeDepth,
                                                 ChallengeMilestone::ReachPureKbnk, kbnMateDepth,
                                                 options);
        st.completeVerification = verify_challenge_progress_to_depth(
          pos, st, challengeDepth, ChallengeMilestone::ReachVerifiedKbnMate, completeKbnDepth,
          options);
    }
    if (st.currentResult == CurrentResult::Losing || st.currentResult == CurrentResult::Drawing)
    {
        st.result = ChallengeResult::ChallengeImpossible;
        st.proof  = ProofLevel::Impossible;
    }
    else if (st.pureKbnk)
    {
        const bool tbWin = st.tablebaseProbeOk
                        && (st.tablebaseWdl == Tablebases::WDLWin
                            || (!bool(options["RespectFiftyMoveRule"])
                                && st.tablebaseWdl == Tablebases::WDLCursedWin));
        st.result = tbWin ? ChallengeResult::CompleteKbnMateForceable
                          : ChallengeResult::CompleteKbnMateLikely;
        st.proof = tbWin && bool(options["UseKBNTablebase"]) ? ProofLevel::ProvenByTablebase
                 : st.kbnVerification.forcedMate          ? ProofLevel::ProvenByForcedMateSearch
                                                           : ProofLevel::HighConfidenceHeuristic;
    }
    else if (st.bishop.exists && st.knight.exists)
    {
        st.result = st.unnecessaryFriendly == 0 && st.enemyPieces == 0
                  ? ChallengeResult::CompleteKbnMateLikely
                  : ChallengeResult::MaterialCleanupRequired;
        st.proof  = st.progressVerification.forceable ? ProofLevel::VerifiedToFixedDepth
                                                       : ProofLevel::HighConfidenceHeuristic;
    }
    else if (st.missingRequiredMinors > 0
             && (st.stablePromotionPawnCandidates >= st.missingRequiredMinors
                 || st.immediateUnderpromotionPawns >= st.missingRequiredMinors)
             && bool(options["PromoteMissingMinor"]))
    {
        st.result = ChallengeResult::PromotionRequiredAndForceable;
        st.proof  = st.progressVerification.forceable ? ProofLevel::VerifiedToFixedDepth
                                                       : ProofLevel::HighConfidenceHeuristic;
    }
    else if (pos.pieces(us, PAWN))
    {
        st.result = ChallengeResult::OnlyPartialSacrificePlanForceable;
        st.proof  = ProofLevel::Unproven;
    }
    else
    {
        st.result = ChallengeResult::ChallengeImpossible;
        st.proof  = ProofLevel::Impossible;
    }
    st.goal = next_goal(pos, us, st);
    return st;
}

int mode_multiplier(const OptionsMap& options) {
    if (options["BadMannersMode"] == "Safe")
        return 1;
    if (options["BadMannersMode"] == "Aggressive")
        return 2;
    if (options["BadMannersMode"] == "Maximum" || options["BadMannersMode"] == "Puzzle")
        return 3;
    return 0;
}

bool root_score_preserves_win(Value score, const OptionsMap& options) {
    if (!bool(options["PreserveForcedWin"]))
        return true;
    if (score == -VALUE_INFINITE)
        return false;
    if (is_win(score) || score >= VALUE_MATE_IN_MAX_PLY)
        return true;
    return score >= Value(int(options["MinimumSafeEvaluation"]));
}

bool after_move_tb_preserves_win(Tablebases::WDLScore wdl, bool respectFiftyMoveRule) {
    return result_from_wdl(wdl, respectFiftyMoveRule) == CurrentResult::Losing;
}

WinPreservationAfterMove win_preservation_after_move(const Position& pos, Move move,
                                                     Value rootScore,
                                                     const ChallengeState& st,
                                                     const MaterialAfterMove& after,
                                                     const DrawRiskAfterMove& drawRisk,
                                                     const OpponentReplySummary& replies,
                                                     const OptionsMap& options) {
    WinPreservationAfterMove summary;
    if (!bool(options["PreserveForcedWin"]))
        return summary;

    summary.rootScoreChecked = true;
    summary.rootScoreSafe    = root_score_preserves_win(rootScore, options);
    summary.preserved        = summary.rootScoreSafe;
    summary.source           = "RootScore";

    StateInfo setupState;
    StateInfo moveState;
    Position  next;
    next.set(pos.fen(), pos.is_chess960(), &setupState);
    next.do_move(move, moveState);

    if (drawRisk.immediateDraw && !drawRisk.immediateCheckmate)
    {
        summary.preserved = false;
        summary.source    = "LocalDraw";
        return summary;
    }

    Tablebases::WDLScore afterWdl = Tablebases::WDLDraw;
    if (tablebase_probe(next, afterWdl))
    {
        summary.tablebaseChecked      = true;
        summary.tablebaseWdl          = afterWdl;
        summary.tablebaseWinPreserved =
          after_move_tb_preserves_win(afterWdl, bool(options["RespectFiftyMoveRule"]));
        summary.preserved = summary.tablebaseWinPreserved;
        summary.source    = "SyzygyWDL";
        return summary;
    }

    if (drawRisk.immediateCheckmate)
    {
        summary.preserved = true;
        summary.source    = "LocalMate";
        return summary;
    }

    summary.pureKbnChecked   = after.pureKbnk;
    summary.pureKbnWinLikely = after.pureKbnk && !drawRisk.immediateDraw
                            && !replies.survivorCanBeCaptured
                            && (!bool(options["RespectFiftyMoveRule"]) || next.rule50_count() < 80);
    if (summary.pureKbnWinLikely)
    {
        summary.preserved = true;
        summary.source    = "PureKBNFinal";
        return summary;
    }

    if (st.completeVerification.forceable && st.completeVerification.firstMove == move)
    {
        summary.preserved = true;
        summary.source    = "FixedDepthComplete";
        return summary;
    }

    if (st.routeVerification.forceable && st.routeVerification.firstMove == move)
    {
        summary.preserved = true;
        summary.source    = "FixedDepthRoute";
        return summary;
    }

    if (st.progressVerification.forceable && st.progressVerification.firstMove == move)
    {
        summary.preserved = true;
        summary.source    = "FixedDepthProgress";
        return summary;
    }

    const bool safeCleanupSacrifice =
      st.unnecessaryFriendly > 0 && replies.safeSacrificeCaptures > 0
      && replies.safeSacrificeCapturesReachPureKbnk > 0
      && replies.unsafeSacrificeCaptureResults == 0 && !replies.survivorCanBeCaptured
      && !replies.requiredPawnCanBeCaptured && after.unnecessaryFriendly <= st.unnecessaryFriendly
      && after.enemyPieces <= st.enemyPieces;
    if (safeCleanupSacrifice)
    {
        summary.preserved = true;
        summary.source    = "SafeCleanupSacrifice";
        return summary;
    }

    const Color us = pos.side_to_move();
    const Square capturedSquare = move.type_of() == EN_PASSANT ? Square(move.to_sq() + pawn_push(~us))
                                                               : move.to_sq();
    const Piece victim = pos.piece_on(capturedSquare);
    const bool safeEnemyCleanupCapture =
      victim != NO_PIECE && color_of(victim) == ~us && type_of(victim) != KING
      && after.enemyPieces < st.enemyPieces && after.unnecessaryFriendly <= st.unnecessaryFriendly
      && after.hasBishop && after.hasKnight && !replies.survivorCanBeCaptured
      && !replies.requiredPawnCanBeCaptured;
    if (safeEnemyCleanupCapture)
    {
        summary.preserved = true;
        summary.source    = "SafeEnemyCleanupCapture";
    }

    return summary;
}

int mate_win_plies(Value score) {
    return score >= VALUE_MATE_IN_MAX_PLY ? VALUE_MATE - int(score) : -1;
}

bool exceeds_allowed_mate_delay(Value bestScore, Value candidateScore, const OptionsMap& options) {
    if (!bool(options["PreserveForcedWin"]))
        return false;

    const int bestMate = mate_win_plies(bestScore);
    if (bestMate < 0)
        return false;

    const int candidateMate = mate_win_plies(candidateScore);
    if (candidateMate < 0)
        return true;

    const int allowedDelay = bool(options["AllowMateDelay"]) ? int(options["MaximumAllowedMateDelay"]) : 0;
    return candidateMate - bestMate > allowedDelay;
}

int rank_move(const Position& pos, const Search::RootMove& rm, const ChallengeState& st,
              const OptionsMap& options, Value bestRootScore) {
    if (st.currentResult == CurrentResult::Losing || st.currentResult == CurrentResult::Drawing)
        return -100000000;
    if (rm.pv.empty())
        return -100000000;
    Move move = rm.pv[0];
    if (!move.is_ok())
        return -100000000;
    const bool isRequiredPromotion = required_promotion(st, move);
    if (move.type_of() == PROMOTION && st.immediateUnderpromotions > 0 && !isRequiredPromotion)
        return -100000000;
    if (exceeds_allowed_mate_delay(bestRootScore, rm.score, options))
        return -100000000;
    const Color us     = pos.side_to_move();
    const Piece moved  = pos.piece_on(move.from_sq());
    const Piece victim = move.type_of() == EN_PASSANT ? make_piece(~us, PAWN) : pos.piece_on(move.to_sq());
    if (moved == NO_PIECE || color_of(moved) != us)
        return -100000000;

    const DrawRiskAfterMove drawRisk = draw_risk_after_move(pos, move);
    const MaterialAfterMove after     = material_after_move(pos, move, st);
    const OpponentReplySummary replies = summarize_replies_after(pos, move, st);
    const WinPreservationAfterMove winSafety =
      win_preservation_after_move(pos, move, rm.score, st, after, drawRisk, replies, options);
    if (!winSafety.preserved)
        return -100000000;
    if (drawRisk.immediateDraw && !drawRisk.immediateCheckmate)
        return -100000000;
    if (drawRisk.immediateCheckmate && bool(options["RequirePureKBNFinal"]) && !after.pureKbnk)
        return -100000000;

    int  score           = rm.score == -VALUE_INFINITE ? int(options["MinimumSafeEvaluation"])
                                                       : int(rm.score);
    bool movesDesignated = is_designated(st.bishop, move.from_sq())
                        || is_designated(st.knight, move.from_sq());
    if (movesDesignated)
        score += 20;
    if (!movesDesignated && bool(options["SacrificeAllOtherPieces"])
        && (pos.attackers_to(move.to_sq(), pos.pieces()) & pos.pieces(~us)))
        score += 180 * mode_multiplier(options);

    if (bool(options["SacrificeAllOtherPieces"]) || bool(options["PreferForcedSacrifices"]))
    {
        if (replies.survivorCanBeCaptured)
            score -= 900 * std::max(1, mode_multiplier(options));
        if (replies.requiredPawnCanBeCaptured)
            score -= 350 * std::max(1, mode_multiplier(options));
        if (replies.forcedSacrifice && bool(options["PreferForcedSacrifices"]))
            score += 320 * std::max(1, mode_multiplier(options));
        else if (replies.safeSacrificeCaptures > 0)
            score += (120 * replies.safeSacrificeCaptures - 20 * replies.refusalMoves)
                   * std::max(1, mode_multiplier(options));
    }
    if (victim != NO_PIECE && color_of(victim) == ~us)
    {
        score += (260 + int(PieceValue[type_of(victim)]) / 2) * mode_multiplier(options);
        if (type_of(victim) == QUEEN || type_of(victim) == ROOK)
            score += 360 * mode_multiplier(options);
    }
    if (move.type_of() == PROMOTION && bool(options["PromoteMissingMinor"]))
    {
        PieceType promo = move.promotion_type();
        if (isRequiredPromotion)
            score += 1200 * std::max(1, mode_multiplier(options));
        else if ((st.bishopMustBePromoted || st.knightMustBePromoted) && (promo == QUEEN || promo == ROOK))
            score -= 2500 * std::max(1, mode_multiplier(options));
    }
    if (bool(options["PromoteMissingMinor"]))
        score += promotion_progress_score(pos, move, us, st) * std::max(1, mode_multiplier(options));
    score += material_progress_score(st, after) * std::max(1, mode_multiplier(options));
    if (st.pureKbnk)
    {
        score += kbn_after_move_score(pos, move, us, st) * std::max(1, mode_multiplier(options));
        const KbnReplySummary kbnReplies = kbn_worst_reply_after_move(pos, move, us, st);
        score += kbnReplies.worstScore * std::max(1, mode_multiplier(options)) / 2;
    }
    if (st.pureKbnk && st.tablebaseMaterialSeen)
        score += rm.tbRank * 10000;
    if (pos.rule50_count() >= 80 && bool(options["RespectFiftyMoveRule"]))
        score -= 200 * mode_multiplier(options);
    if (drawRisk.immediateCheckmate)
        score += 500 * std::max(1, mode_multiplier(options));
    return score;
}

bool forbidden_non_pure_mate(const Position& pos, Move move, const ChallengeState& st,
                             const OptionsMap& options) {
    if (!bool(options["RequirePureKBNFinal"]) || !move.is_ok())
        return false;
    const DrawRiskAfterMove drawRisk = draw_risk_after_move(pos, move);
    if (!drawRisk.immediateCheckmate)
        return false;
    return !material_after_move(pos, move, st).pureKbnk;
}

bool exposes_critical_route_capture(const Position& pos, Move move, const ChallengeState& st) {
    if (!move.is_ok())
        return false;
    const OpponentReplySummary replies = summarize_replies_after(pos, move, st);
    return replies.survivorCanBeCaptured || replies.requiredPawnCanBeCaptured;
}

int fallback_safety_score(const Position& pos, const Search::RootMove& rm,
                          const ChallengeState& st, const OptionsMap& options) {
    if (rm.pv.empty())
        return -100000000;

    Move move = rm.pv[0];
    if (!move.is_ok())
        return -100000000;

    const DrawRiskAfterMove drawRisk = draw_risk_after_move(pos, move);
    if (drawRisk.immediateDraw && !drawRisk.immediateCheckmate)
        return -100000000;
    if (forbidden_non_pure_mate(pos, move, st, options))
        return -100000000;
    if (exposes_critical_route_capture(pos, move, st))
        return -100000000;

    const Color us = pos.side_to_move();
    int score = rm.score == -VALUE_INFINITE ? 0 : int(rm.score) / 8;
    if (required_promotion(st, move))
        score += 200000;
    score += promotion_progress_score(pos, move, us, st) * 8;

    const MaterialAfterMove after = material_after_move(pos, move, st);
    score += material_progress_score(st, after) * 4;
    if (after.bishopAttackers == 0 && after.knightAttackers == 0)
        score += 1500;

    StateInfo setupState;
    StateInfo moveState;
    Position  next;
    next.set(pos.fen(), pos.is_chess960(), &setupState);
    next.do_move(move, moveState);
    if (next.checkers())
        score += 700;

    return score;
}

}  // namespace

bool enabled(const OptionsMap& options) {
    if (!options.count("BadMannersMode"))
        return false;
    return options["BadMannersMode"] != "Off" && bool(options["KBNMateChallenge"]);
}

size_t effective_multipv(const OptionsMap& options, size_t rootMoveCount) {
    size_t multiPV = std::min(size_t(options["MultiPV"]), rootMoveCount);
    if (!enabled(options) || rootMoveCount == 0)
        return multiPV;

    const size_t configured = size_t(std::max(1, int(options["ChallengePlanningDepth"])));
    const size_t candidates = std::clamp(configured, size_t(4), size_t(24));
    return std::min(rootMoveCount, std::max(multiPV, candidates));
}

std::string report(const Position& pos, const OptionsMap& options) {
    const ChallengeState st = analyze(pos, options);
    std::ostringstream   os;
    os << "[KBN Challenge Report]\n";
    os << "FEN: " << pos.fen() << "\n";
    os << "Side: " << (pos.side_to_move() == WHITE ? "White" : "Black") << "\n";
    os << "Current result: " << current_result_name(st.currentResult) << "\n";
    os << "Current result source: " << (st.tablebaseProbeOk ? "Syzygy WDL" : "Local terminal/draw checks or unknown") << "\n";
    if (st.tablebaseProbeOk)
        os << "Tablebase WDL: " << wdl_name(st.tablebaseWdl) << "\n";
    os << "Tablebase DTZ: ";
    if (st.tablebaseDtzOk)
        os << st.tablebaseDtz << "\n";
    else
        os << "Unavailable\n";
    os << "Challenge state: " << result_name(st.result) << "\n";
    os << "Proof level: " << proof_name(st.proof) << "\n";
    os << "Current bishop available: " << (st.bishop.exists ? "Yes" : "No") << "\n";
    os << "Current knight available: " << (st.knight.exists ? "Yes" : "No") << "\n";
    os << "Required promotion: ";
    if (!st.bishopMustBePromoted && !st.knightMustBePromoted)
        os << "No\n";
    else
        os << (st.bishopMustBePromoted ? "Bishop" : "")
           << (st.bishopMustBePromoted && st.knightMustBePromoted ? ", " : "")
           << (st.knightMustBePromoted ? "Knight" : "") << "\n";
    os << "Candidate promotion routes: " << st.promotionCandidates << "\n";
    os << "Distinct promotion pawns: " << st.promotionPawnCandidates << "\n";
    os << "Stable promotion pawns: " << st.stablePromotionPawnCandidates << "\n";
    os << "Attacked promotion pawns: " << st.attackedPromotionPawnCandidates << "\n";
    os << "Immediate required underpromotions: " << st.immediateUnderpromotions << "\n";
    os << "Immediate required underpromotion pawns: " << st.immediateUnderpromotionPawns << "\n";
    os << "Designated bishop: " << piece_identity_text(pos, st.bishop) << "\n";
    os << "Designated bishop attackers: " << st.bishopAttackers << "\n";
    os << "Designated knight: " << piece_identity_text(pos, st.knight) << "\n";
    os << "Designated knight attackers: " << st.knightAttackers << "\n";
    os << "Designated survivor attack risk: "
       << (st.bishopAttackers > 0 || st.knightAttackers > 0 ? "Yes" : "No") << "\n";
    os << "Unnecessary friendly pieces remaining: " << st.unnecessaryFriendly << "\n";
    os << "Enemy pieces remaining: " << st.enemyPieces << "\n";
    os << "Material cleanup required: "
       << (st.unnecessaryFriendly > 0 || st.enemyPieces > 0 ? "Yes" : "No") << "\n";
    os << "Pure KBN final required: " << (bool(options["RequirePureKBNFinal"]) ? "Yes" : "No")
       << "\n";
    os << "Pure KBN final satisfied: " << (st.pureKbnk ? "Yes" : "No") << "\n";
    os << "Can pure KBN versus king be forced: " << proof_name(st.proof) << "\n";
    os << "Final KBN tablebase: " << (st.pureKbnk && st.tablebaseProbeOk ? "Reached" : "Not reached") << "\n";
    os << "Final KBN tablebase proof: "
       << (st.pureKbnk && st.tablebaseProbeOk
             ? (st.tablebaseDtzOk ? "Syzygy WDL+DTZ" : "Syzygy WDL")
             : "Unavailable")
       << "\n";
    os << "Bishop color: " << (st.bishop.exists ? square_color_name(st.bishop.square) : "Unknown") << "\n";
    os << "Correct mating corners: ";
    if (st.cornerA == SQ_NONE)
        os << "Unknown\n";
    else
        os << UCIEngine::square(st.cornerA) << " and " << UCIEngine::square(st.cornerB) << "\n";
    os << "KBN phase: " << kbn_phase_name(st.kbnPhase) << "\n";
    os << "KBN fixed-depth verification: ";
    if (!st.kbnVerification.attempted)
        os << "Not attempted\n";
    else if (st.kbnVerification.forcedMate)
        os << "Forced mate in " << st.kbnVerification.matePly << " ply within depth "
           << st.kbnVerification.depth << "\n";
    else
        os << "No forced mate found within depth " << st.kbnVerification.depth
           << (st.kbnVerification.truncated ? " (truncated)" : "") << "\n";
    os << "KBN fixed-depth nodes: " << st.kbnVerification.nodes << "\n";
    os << "KBN fixed-depth cache hits: " << st.kbnVerification.cacheHits << "\n";
    os << "Challenge progress target: " << milestone_name(st.progressVerification.target) << "\n";
    os << "Challenge progress verification: ";
    if (!st.progressVerification.attempted)
        os << "Not attempted\n";
    else
        os << (st.progressVerification.forceable ? "Forceable" : "Not forceable")
           << " within depth " << st.progressVerification.depth
           << (st.progressVerification.truncated ? " (truncated)" : "") << "\n";
    os << "Challenge progress first move: "
       << (st.progressVerification.firstMove == Move::none()
             ? "None"
             : UCIEngine::move(st.progressVerification.firstMove, pos.is_chess960()))
       << "\n";
    os << "Challenge progress nodes: " << st.progressVerification.nodes << "\n";
    os << "Challenge progress cache hits: " << st.progressVerification.cacheHits << "\n";
    os << "Full challenge route target: " << milestone_name(st.routeVerification.target) << "\n";
    os << "Full challenge route verification: ";
    if (!st.routeVerification.attempted)
        os << "Not attempted\n";
    else
        os << (st.routeVerification.forceable ? "Forceable" : "Not forceable")
           << " within depth " << st.routeVerification.depth
           << (st.routeVerification.truncated ? " (truncated)" : "") << "\n";
    os << "Full challenge route first move: "
       << (st.routeVerification.firstMove == Move::none()
             ? "None"
             : UCIEngine::move(st.routeVerification.firstMove, pos.is_chess960()))
       << "\n";
    os << "Full challenge route nodes: " << st.routeVerification.nodes << "\n";
    os << "Full challenge route cache hits: " << st.routeVerification.cacheHits << "\n";
    os << "Complete challenge target: " << milestone_name(st.completeVerification.target) << "\n";
    os << "Complete challenge verification: ";
    if (!st.completeVerification.attempted)
        os << "Not attempted\n";
    else
        os << (st.completeVerification.forceable ? "Forceable" : "Not forceable")
           << " within challenge depth " << st.completeVerification.depth
           << " and KBN depth " << std::clamp(int(options["CompleteKBNVerificationDepth"]), 1, 64)
           << (st.completeVerification.truncated ? " (truncated)" : "") << "\n";
    os << "Complete challenge first move: "
       << (st.completeVerification.firstMove == Move::none()
             ? "None"
             : UCIEngine::move(st.completeVerification.firstMove, pos.is_chess960()))
       << "\n";
    os << "Complete challenge nodes: " << st.completeVerification.nodes << "\n";
    os << "Complete challenge cache hits: " << st.completeVerification.cacheHits << "\n";
    os << "Current material goal: " << goal_name(st.goal) << "\n";
    os << "Stalemate risk: Position-dependent\n";
    os << "50-move risk: " << (pos.rule50_count() >= 80 ? "High" : (pos.rule50_count() >= 50 ? "Medium" : "Low")) << "\n";
    os << "Opponent cooperation required: No for legal Stockfish search; full challenge proof requires tablebase or fixed-depth verification\n";
    return os.str();
}

void reorder_root_moves(const Position& pos, Search::RootMoves& rootMoves, const OptionsMap& options) {
    if (!enabled(options) || rootMoves.empty())
        return;
    const ChallengeState st = analyze(pos, options);
    Value                bestRootScore = -VALUE_INFINITE;
    for (const auto& rm : rootMoves)
        if (rm.score != -VALUE_INFINITE)
            bestRootScore = std::max(bestRootScore, rm.score);

    const auto scoreOf = [&](const Search::RootMove& rm) {
        return rank_move(pos, rm, st, options, bestRootScore);
    };
    auto                 best    = std::max_element(rootMoves.begin(), rootMoves.end(),
                                     [&](const Search::RootMove& a, const Search::RootMove& b) {
                                         return scoreOf(a) < scoreOf(b);
                                     });
    if (best != rootMoves.end() && scoreOf(*best) > -100000000)
        std::stable_sort(rootMoves.begin(), rootMoves.end(),
                         [&](const Search::RootMove& a, const Search::RootMove& b) {
                             return scoreOf(a) > scoreOf(b);
                         });
    else if (bool(options["RequirePureKBNFinal"]))
    {
        const auto safetyScore = [&](const Search::RootMove& rm) {
            return fallback_safety_score(pos, rm, st, options);
        };
        if (std::any_of(rootMoves.begin(), rootMoves.end(),
                        [&](const Search::RootMove& rm) { return safetyScore(rm) > -100000000; }))
            std::stable_sort(rootMoves.begin(), rootMoves.end(),
                             [&](const Search::RootMove& a, const Search::RootMove& b) {
                                 const int scoreA = safetyScore(a);
                                 const int scoreB = safetyScore(b);
                                 if ((scoreA > -100000000) != (scoreB > -100000000))
                                     return scoreA > scoreB;
                                 return scoreA > scoreB;
                             });
    }
}

std::string explain_selected_move(const Position& pos, const Search::RootMove& rootMove,
                                  const OptionsMap& options) {
    const ChallengeState st = analyze(pos, options);
    std::ostringstream   os;
    const int challengeRank =
      rootMove.pv.empty() ? -100000000 : rank_move(pos, rootMove, st, options, rootMove.score);
    os << (challengeRank > -100000000 ? "Bad Manners selected "
                                      : "Bad Manners did not override; normal best ")
       << (rootMove.pv.empty() ? "(none)" : UCIEngine::move(rootMove.pv[0], pos.is_chess960()))
       << "; normal search score " << rootMove.score << "; challenge " << result_name(st.result)
       << "; proof " << proof_name(st.proof) << "; goal " << goal_name(st.goal);
    if (st.cornerA != SQ_NONE)
        os << "; target corners " << UCIEngine::square(st.cornerA) << " or "
           << UCIEngine::square(st.cornerB);
    os << "; current survivor attack risk "
       << (st.bishopAttackers > 0 || st.knightAttackers > 0 ? "yes" : "no");
    if (needs_promotion_piece(st))
        os << "; stable promotion pawns " << st.stablePromotionPawnCandidates
           << "; attacked promotion pawns " << st.attackedPromotionPawnCandidates
           << "; immediate underpromotion pawns " << st.immediateUnderpromotionPawns;
    if (!rootMove.pv.empty() && rootMove.pv[0].is_ok())
    {
        const MaterialAfterMove   after   = material_after_move(pos, rootMove.pv[0], st);
        const DrawRiskAfterMove   drawRisk = draw_risk_after_move(pos, rootMove.pv[0]);
        const OpponentReplySummary replies = summarize_replies_after(pos, rootMove.pv[0], st);
        const WinPreservationAfterMove winSafety =
          win_preservation_after_move(pos, rootMove.pv[0], rootMove.score, st, after, drawRisk, replies,
                                      options);
        os << "; after move unnecessary friendly " << after.unnecessaryFriendly
           << "; after move enemy pieces " << after.enemyPieces
           << "; after move pure KBNK " << (after.pureKbnk ? "yes" : "no")
           << "; after move bishop attackers " << after.bishopAttackers
           << "; after move knight attackers " << after.knightAttackers;
        os << "; after move win preserved " << (winSafety.preserved ? "yes" : "no")
           << "; after move win source " << winSafety.source
           << "; root score safe " << (winSafety.rootScoreSafe ? "yes" : "no");
        if (winSafety.tablebaseChecked)
            os << "; after move tablebase WDL " << wdl_name(winSafety.tablebaseWdl);
        if (winSafety.pureKbnChecked)
            os << "; after move pure KBN win likely "
               << (winSafety.pureKbnWinLikely ? "yes" : "no");
        if (after.pureKbnk)
        {
            StateInfo setupState;
            StateInfo moveState;
            Position  next;
            next.set(pos.fen(), pos.is_chess960(), &setupState);
            next.do_move(rootMove.pv[0], moveState);
            const KbnReplySummary kbnReplies =
              kbn_worst_reply_after_move(pos, rootMove.pv[0], pos.side_to_move(), st);
            os << "; after move KBN phase "
               << kbn_phase_name(classify_kbn_phase(next, pos.side_to_move(), st));
            os << "; KBN worst reply legal replies " << kbnReplies.legalReplies
               << "; KBN worst reply "
               << (kbnReplies.worstMove == Move::none()
                     ? "none"
                     : UCIEngine::move(kbnReplies.worstMove, next.is_chess960()))
               << "; KBN worst reply phase " << kbn_phase_name(kbnReplies.worstPhase)
               << "; KBN worst reply score " << kbnReplies.worstScore;
        }
        os << "; opponent legal replies " << drawRisk.opponentLegalMoves
           << "; immediate stalemate risk " << (drawRisk.immediateStalemate ? "yes" : "no")
           << "; immediate draw risk " << (drawRisk.immediateDraw ? "yes" : "no");
        os << "; opponent safe sacrifice captures " << replies.safeSacrificeCaptures
           << "; safe sacrifice captures reach pure KBNK "
           << replies.safeSacrificeCapturesReachPureKbnk
           << "; unsafe sacrifice capture results " << replies.unsafeSacrificeCaptureResults
           << "; refusal moves " << replies.refusalMoves
           << "; forced sacrifice " << (replies.forcedSacrifice ? "yes" : "no")
           << "; survivor capture risk " << (replies.survivorCanBeCaptured ? "yes" : "no")
           << "; required pawn capture risk " << (replies.requiredPawnCanBeCaptured ? "yes" : "no");
    }
    if (st.pureKbnk)
        os << "; KBN fallback phase active";
    return os.str();
}

}  // namespace Stockfish::BadManners
