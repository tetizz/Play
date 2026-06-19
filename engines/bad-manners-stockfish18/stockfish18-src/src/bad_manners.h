/*
  Bad Manners Stockfish challenge layer for Stockfish 18.
*/

#ifndef BAD_MANNERS_H_INCLUDED
#define BAD_MANNERS_H_INCLUDED

#include <cstddef>
#include <string>

#include "position.h"
#include "search.h"
#include "ucioption.h"

namespace Stockfish::BadManners {

bool enabled(const OptionsMap& options);

size_t effective_multipv(const OptionsMap& options, size_t rootMoveCount);

std::string report(const Position& pos, const OptionsMap& options);

void reorder_root_moves(const Position& pos, Search::RootMoves& rootMoves, const OptionsMap& options);

std::string explain_selected_move(const Position&         pos,
                                  const Search::RootMove& rootMove,
                                  const OptionsMap&       options);

}

#endif
