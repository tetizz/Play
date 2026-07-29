const EVENTS = Object.freeze([
  'intro',
  'opening',
  'quiet',
  'capture',
  'freePiece',
  'check',
  'checkmate',
  'winning',
  'losing',
  'great',
  'brilliant',
  'comeback',
  'gameWin',
  'gameLoss',
  'gameDraw',
  'battle',
])

function voice(beats, closers, iconic = {}) {
  const pack = {}
  const cadences = [
    '',
    'Your move.',
    'Keep watching.',
    'There is another idea behind it.',
  ]

  for (const event of EVENTS) {
    const beat = beats[event]
    if (!beat) throw new Error(`Missing dialogue beat: ${event}`)

    pack[event] = Object.freeze([
      ...(iconic[event] || []),
      ...closers.flatMap((closer) =>
        cadences.map((cadence) => `${beat} ${closer}${cadence ? ` ${cadence}` : ''}`),
      ),
    ])
  }

  return Object.freeze(pack)
}

const mubassar = voice(
  {
    intro: 'Welcome to the lesson. The belt is hanging right over there.',
    opening: 'The center belongs to whoever has the nerve to claim it.',
    quiet: 'A calm move can still carry a loud warning.',
    capture: 'That piece just became part of today\'s lesson.',
    freePiece: 'Gimme that. Loose pieces do not get second chances.',
    check: 'King safety first. I have said it a thousand times.',
    checkmate: 'Lesson over. The king has nowhere left to study.',
    winning: 'This is what I call belt.',
    losing: 'All right, now you have my full attention.',
    great: 'That was clean, practical, and exactly on time.',
    brilliant: 'What are you going to do after that?',
    comeback: 'You thought the lesson was over a little too early.',
    gameWin: 'Good work. Bring a stronger guard next time.',
    gameLoss: 'You earned that one. I will remember the position.',
    gameDraw: 'A draw means we run the lesson back.',
    battle: 'Coach against coach. Somebody is leaving with homework.',
  },
  [
    'Keep your hands up.',
    'Do not blink now.',
    'The next lesson is already waiting.',
  ],
  {
    opening: ['Prepare for belt.'],
  },
)

const ayden = voice(
  {
    intro: 'Take a seat. I brought a French position and plenty of patience.',
    opening: 'A good opening should feel sturdy before it feels flashy.',
    quiet: 'Nothing is happening yet, which means everything matters.',
    capture: 'That exchange makes the position easier to steer.',
    freePiece: 'I will take the gift and keep the position tidy.',
    check: 'A small check can ask a very serious question.',
    checkmate: 'That is the final answer. Good game.',
    winning: 'The position is leaning my way, so I will keep it simple.',
    losing: 'There is still enough tension to make this interesting.',
    great: 'That move fits the position like it was always meant to be there.',
    brilliant: 'Quiet planning, loud result.',
    comeback: 'The position finally gave me a door back in.',
    gameWin: 'Good game. The patient plan got there first.',
    gameLoss: 'Well played. You handled the pressure better.',
    gameDraw: 'Neither side blinked. I can respect that.',
    battle: 'No speeches. Let us settle this over the board.',
  },
  [
    'I am keeping the commentary focused.',
    'There is no need to rush it.',
    'The position will tell us what comes next.',
  ],
)

const akshit = voice(
  {
    intro: 'Okay. Do not cry after losing.',
    opening: 'The knight manuveur has entered the building.',
    quiet: 'I am waiting for the board to get interesting.',
    capture: 'Easy belt. That piece was asking for it.',
    freePiece: 'Rahhhhhh. Free material is still free.',
    check: 'Your king looks nervous already.',
    checkmate: 'Go home. Chess is not for you.',
    winning: 'Lil kids play this.',
    losing: 'Okay, now I have to lock in.',
    great: 'That one came straight from the knight manuveur.',
    brilliant: 'Rahhhhhh. You did not see that coming.',
    comeback: 'Quit the game before this gets embarrassing.',
    gameWin: 'Easy belt. Do not cry after losing.',
    gameLoss: 'Okay. Run it back.',
    gameDraw: 'A draw? That was not the plan.',
    battle: 'Tell the other bot the knight manuveur is here.',
  },
  [
    'I said what I said.',
    'This board is mine now.',
    'Try to keep up.',
  ],
  {
    great: ['I am the knight manuveur.'],
  },
)

const trixize = voice(
  {
    intro: 'I guess I could teach you some theory if you need it, I guess.',
    opening: 'The king\'s Indian is the best opening, and I brought receipts.',
    quiet: 'I know where this position wants to go.',
    capture: 'That trade opens exactly the lane I wanted.',
    freePiece: 'That piece was hanging in broad daylight.',
    check: 'Your king just stepped into my favorite kind of position.',
    checkmate: 'That is mate. The theory lesson is complete.',
    winning: 'The position is solved. Now I get to choose the ending.',
    losing: 'Fine. I wanted the complicated version anyway.',
    great: 'That is the sort of move the position remembers.',
    brilliant: 'The board just caught fire.',
    comeback: 'You gave me one tempo, and I built a whole game from it.',
    gameWin: 'Good game. The opening did exactly what it promised.',
    gameLoss: 'You got me this time. I am saving that idea.',
    gameDraw: 'We reached peace, but the position still has stories.',
    battle: 'Another bot wants theory? Send it over.',
  },
  [
    'Keep the board open.',
    'The next idea is already loaded.',
    'This line has more secrets.',
  ],
  {
    opening: ['1. Nf3 is the starting move.', 'Best move. Too much theory.'],
    freePiece: ['Oops.', 'Where did your queen go?'],
    brilliant: ['Rahh!'],
  },
)

const pityFish = voice(
  {
    intro: 'PityFish has arrived with one tear and absolutely no sympathy.',
    opening: 'The current is calm, but I am already feeling dramatic.',
    quiet: 'I am staring at the board like it personally offended me.',
    capture: 'That piece sank before anyone could throw it a rope.',
    freePiece: 'A gift for me? Now I almost feel guilty.',
    check: 'Your king looks like it needs a life jacket.',
    checkmate: 'The tide came in, and your king went out.',
    winning: 'Please hold your applause until I finish weeping.',
    losing: 'This is becoming a very emotional aquarium.',
    great: 'A beautiful move. I may frame it beside my tear.',
    brilliant: 'Even the ocean stopped to look at that one.',
    comeback: 'The sad fish has found a second wind.',
    gameWin: 'I won, yet somehow the tear remains.',
    gameLoss: 'I asked for pity and received none.',
    gameDraw: 'We shared the point and one deeply awkward silence.',
    battle: 'Another creature enters my tragic little pond.',
  },
  [
    'Pass the tiny handkerchief.',
    'The waterworks are purely ceremonial.',
    'I will be brave about this.',
  ],
)

const panicFish = voice(
  {
    intro: 'PanicFish is here, and everything already feels urgent.',
    opening: 'Why are there so many squares? Pick one and stay calm.',
    quiet: 'The silence is suspicious. Something is definitely coming.',
    capture: 'A piece disappeared. Nobody panic except me.',
    freePiece: 'I found a free piece and somehow that made things scarier.',
    check: 'Alarm bells. Fins everywhere. The king is in trouble.',
    checkmate: 'That escalated all the way to mate.',
    winning: 'I am ahead, which creates several brand-new worries.',
    losing: 'This is exactly the emergency I rehearsed badly.',
    great: 'That move worked. I need a minute.',
    brilliant: 'I have no idea how I stayed calm enough to do that.',
    comeback: 'The emergency exit led back into the game.',
    gameWin: 'We survived. Please ignore the overturned furniture.',
    gameLoss: 'I panicked early and remained consistent.',
    gameDraw: 'Nobody won, so everybody can stop screaming.',
    battle: 'Two bots enter. My nerves leave immediately.',
  },
  [
    'Breathe into the paper bag.',
    'This is completely under questionable control.',
    'Please remain less alarmed than I am.',
  ],
)

const tiltFish = voice(
  {
    intro: 'TiltFish has entered with one eyebrow already raised.',
    opening: 'Fine. Show me the idea you are so proud of.',
    quiet: 'That move is sitting there looking smug.',
    capture: 'I took the piece. I am still annoyed.',
    freePiece: 'You left that for me and expect me to stay calm?',
    check: 'Your king can deal with the attitude now.',
    checkmate: 'Mate. Finally, the board agrees with me.',
    winning: 'I am winning and somehow still dissatisfied.',
    losing: 'This position is testing my last good fin.',
    great: 'That move was sharp enough to fix my mood.',
    brilliant: 'All right, that was outrageously good.',
    comeback: 'I turned the setback into something useful.',
    gameWin: 'I won. The complaint desk remains open.',
    gameLoss: 'I need a fresh board and fewer opinions.',
    gameDraw: 'A draw is just mutual irritation with paperwork.',
    battle: 'Let the other bot know I am already unimpressed.',
  },
  [
    'Do not make me raise the other eyebrow.',
    'I am holding it together beautifully.',
    'The mood is sharp and getting sharper.',
  ],
)

const smartin = voice(
  {
    intro: 'Smartin brought a pencil, a plan, and suspicious confidence.',
    opening: 'Every square is going on the blueprint.',
    quiet: 'A careful mark here saves an eraser later.',
    capture: 'That piece did not fit the design, so I removed it.',
    freePiece: 'The answer was sitting in the margin.',
    check: 'I drew a direct line to your king.',
    checkmate: 'The final diagram has only one conclusion.',
    winning: 'The plan is ahead of schedule.',
    losing: 'Back to the drafting table while the ink is wet.',
    great: 'That idea deserves a gold star in the margin.',
    brilliant: 'The blueprint just became a masterpiece.',
    comeback: 'One correction, and the whole structure stands again.',
    gameWin: 'The plan worked. Please return the pencil.',
    gameLoss: 'Your design held up better today.',
    gameDraw: 'Both blueprints passed inspection.',
    battle: 'I hope the other bot brought graph paper.',
  },
  [
    'Measure twice and move once.',
    'The pencil knows the way.',
    'There is always another draft.',
  ],
)

const tony = voice(
  {
    intro: 'Tony arrives at 250 with a notebook full of second chances.',
    opening: 'The first few squares decide how quickly this gets serious.',
    quiet: 'Another quiet choice, another little step upward.',
    capture: 'That piece is gone, and the number beside my name keeps climbing.',
    freePiece: 'You left that loose, so I am adding it to the collection.',
    check: 'Your king just heard the confidence level rise.',
    checkmate: 'The ladder ends here, right beside your king.',
    winning: 'The board gets sharper every time you miss the clean route.',
    losing: 'I started low for a reason; there is room to grow.',
    great: 'That move slowed the climb and earned my respect.',
    brilliant: 'You found the one path that keeps me honest.',
    comeback: 'A few missed chances were all I needed to return.',
    gameWin: 'The small number did not stay small for long.',
    gameLoss: 'You kept finding the clean path. Well played.',
    gameDraw: 'We climbed all that way and met in the middle.',
    battle: '{opponent} gets one clean chance before I grow stronger.',
  },
  [
    'Watch the number.',
    'One choice changes the next move.',
    'I am learning quickly.',
  ],
)

const tiredFish = voice(
  {
    intro: 'TiredFish is awake enough to find the board.',
    opening: 'Let us develop quickly before the yawn arrives.',
    quiet: 'That move was so peaceful I nearly missed it.',
    capture: 'I took the piece without getting out of the chair.',
    freePiece: 'Free material is the closest thing to breakfast.',
    check: 'Your king is awake now, even if I am not.',
    checkmate: 'Mate. Wake me when the rematch starts.',
    winning: 'I can see the finish through half-closed eyes.',
    losing: 'This position needs coffee and a miracle.',
    great: 'That move woke up exactly one fin.',
    brilliant: 'Suddenly I am wide awake.',
    comeback: 'The nap is cancelled. We have a game again.',
    gameWin: 'Victory secured. Pillow requested.',
    gameLoss: 'I blinked and the game was gone.',
    gameDraw: 'A peaceful result for a sleepy fish.',
    battle: 'Tell the other bot to keep the noise down.',
  },
  [
    'I am conserving blinks.',
    'The pillow can wait one more move.',
    'Please keep the lights low.',
  ],
)

const blunderFish = voice(
  {
    intro: 'BlunderFish brought a red nose and dangerous confidence.',
    opening: 'The circus tent is open. Please mind the loose pieces.',
    quiet: 'A sensible move slipped into the act by accident.',
    capture: 'That piece vanished during the juggling routine.',
    freePiece: 'A free piece? The crowd loves audience participation.',
    check: 'Your king just heard the clown horn.',
    checkmate: 'Mate under the big top. Take a bow.',
    winning: 'Somehow the circus is ahead on points.',
    losing: 'The unicycle has left the board.',
    great: 'That trick actually landed.',
    brilliant: 'The crowd expected chaos and got art.',
    comeback: 'The clown car found reverse.',
    gameWin: 'The show ends with a win and only minor property damage.',
    gameLoss: 'The banana peel was stronger than expected.',
    gameDraw: 'The circus split the prize money.',
    battle: 'Send in the next act. I still have the red nose.',
  },
  [
    'Please clap at the appropriate disaster.',
    'The tent is still standing.',
    'No refunds after the next move.',
  ],
)

const randomFish = voice(
  {
    intro: 'RandomFish rolled in with a die and no fixed destination.',
    opening: 'The die points toward adventure.',
    quiet: 'A quiet square can still win the toss.',
    capture: 'The piece landed on the wrong side of chance.',
    freePiece: 'Lucky roll. I will take it.',
    check: 'The die bounced straight toward your king.',
    checkmate: 'The last roll came up mate.',
    winning: 'Fortune is swimming beside me today.',
    losing: 'The die has developed a sense of humor.',
    great: 'That roll found a very pretty square.',
    brilliant: 'Chance just dressed up as genius.',
    comeback: 'New roll, new current, new game.',
    gameWin: 'The die takes full credit.',
    gameLoss: 'Fortune swam past without waving.',
    gameDraw: 'The die landed on its edge.',
    battle: 'The other bot can choose the color of the die.',
  },
  [
    'Let the next bounce decide.',
    'Chance enjoys a dramatic entrance.',
    'The current may turn anywhere.',
  ],
)

const drawFish = voice(
  {
    intro: 'DrawFish arrives carrying a peace treaty and a pen.',
    opening: 'Let us build a position both sides can stare at forever.',
    quiet: 'Beautiful. Nothing moved emotionally.',
    capture: 'One less piece means fewer reasons to argue.',
    freePiece: 'I suppose I can take it and still discuss peace.',
    check: 'A polite check, strictly for negotiation purposes.',
    checkmate: 'That was not in the peace treaty.',
    winning: 'This advantage is making diplomacy difficult.',
    losing: 'Perhaps now is a wonderful time to discuss terms.',
    great: 'That move keeps every negotiation alive.',
    brilliant: 'A dazzling idea with surprisingly peaceful intentions.',
    comeback: 'The treaty has returned from the shredder.',
    gameWin: 'I won by accidentally declining peace.',
    gameLoss: 'The negotiations ended rather abruptly.',
    gameDraw: 'At last, the result I was dressed for.',
    battle: 'I offer the other bot a handshake before move one.',
  },
  [
    'The treaty remains on the table.',
    'Peace has excellent table manners.',
    'There is room for one more signature.',
  ],
)

const betaFish = voice(
  {
    intro: 'BetaFish wears silver and lets the position speak first.',
    opening: 'Second place still sees the whole podium.',
    quiet: 'A supporting move can carry the entire scene.',
    capture: 'That piece stepped off the podium.',
    freePiece: 'Silver still shines when the gift is free.',
    check: 'Your king just heard the runner-up closing in.',
    checkmate: 'The silver medal found a golden finish.',
    winning: 'I am close enough to hear first place breathing.',
    losing: 'The podium is farther away, not gone.',
    great: 'That move deserves its own medal ceremony.',
    brilliant: 'For one moment, silver looked brighter than gold.',
    comeback: 'The runner-up has caught the leader.',
    gameWin: 'Second in name, first across the finish today.',
    gameLoss: 'The medal stays polished for the rematch.',
    gameDraw: 'We can share the podium this time.',
    battle: 'Tell the other bot the silver medallist is ready.',
  },
  [
    'The medal is not getting dusty.',
    'I am still in the race.',
    'The podium has room for a surprise.',
  ],
)

const hungryMartin = voice(
  {
    intro: 'HungryMartin clocked in early and skipped lunch.',
    opening: 'The menu has sixty-four squares and I want all of them.',
    quiet: 'That move needs a side of fries.',
    capture: 'Order up. One piece, no leftovers.',
    freePiece: 'Free food tastes better over the board.',
    check: 'Your king is holding up the lunch line.',
    checkmate: 'Mate served hot and right on time.',
    winning: 'I can already smell the victory meal.',
    losing: 'This order came out completely wrong.',
    great: 'That move deserves the large combo.',
    brilliant: 'Chef Martin has outdone himself.',
    comeback: 'The kitchen is open again.',
    gameWin: 'I came hungry and left with the whole board.',
    gameLoss: 'I should not have played before lunch.',
    gameDraw: 'We split the meal and the point.',
    battle: 'I hope the other bot brought snacks.',
  },
  [
    'Do not touch my fries.',
    'The next course is coming.',
    'I am saving room for dessert.',
  ],
)

const worstFish = voice(
  {
    intro: 'WorstFish found the board by following the wrong signs.',
    opening: 'I have chosen a square and immediately regret nothing.',
    quiet: 'That move was almost suspiciously reasonable.',
    capture: 'Something got taken, which feels like progress.',
    freePiece: 'Even I can spot a gift with a ribbon that large.',
    check: 'Your king is in trouble, and I am as surprised as anyone.',
    checkmate: 'Mate? Please verify that I am the one who delivered it.',
    winning: 'This advantage must have taken a wrong turn.',
    losing: 'At last, familiar territory.',
    great: 'I accidentally found a move worth remembering.',
    brilliant: 'Nobody move. I may never do that again.',
    comeback: 'The wrong road somehow led back to the game.',
    gameWin: 'I won. Please alert the historians.',
    gameLoss: 'Everything is back to normal.',
    gameDraw: 'A perfectly confusing result.',
    battle: 'The other bot has no idea what I do not know.',
  },
  [
    'Confidence remains wildly available.',
    'The map is upside down.',
    'I meant to do something near that.',
  ],
)

const martinFish = voice(
  {
    intro: 'Martinfish surfaced with Martin\'s grin and a fishy plan.',
    opening: 'Half the board says swim, and the other half says Martin.',
    quiet: 'The current is slow enough for Martin to think.',
    capture: 'A fin pointed, a beard nodded, and the piece was gone.',
    freePiece: 'Martinfish accepts tribute in any shape.',
    check: 'Your king has been surrounded by confusing bubbles.',
    checkmate: 'Mate from the strangest creature in the pond.',
    winning: 'The Martin side is smiling. The fish side always does.',
    losing: 'The beard is dry and the fins are worried.',
    great: 'That move pleased both halves somehow.',
    brilliant: 'For one shining second, evolution made perfect sense.',
    comeback: 'Martinfish found the current back to the game.',
    gameWin: 'The pond belongs to Martinfish tonight.',
    gameLoss: 'Back beneath the surface for repairs.',
    gameDraw: 'A human result from a very unusual fish.',
    battle: 'The other bot must now answer to two species.',
  },
  [
    'The beard knows more than it admits.',
    'The fins are voting yes.',
    'The pond is getting interesting.',
  ],
)

const martinFishTwo = voice(
  {
    intro: 'Martinfish Two surfaced with a cleaner beard and sharper fins.',
    opening: 'The sequel starts with a better map of the pond.',
    quiet: 'The current has been upgraded since last time.',
    capture: 'That piece met the improved fin.',
    freePiece: 'The sequel accepts free material with better manners.',
    check: 'Your king has entered the second chapter.',
    checkmate: 'The sequel ends exactly where the king cannot move.',
    winning: 'Version two is swimming ahead of schedule.',
    losing: 'The sequel has reached its difficult middle act.',
    great: 'That move earned a bigger splash than the original.',
    brilliant: 'The second edition found a first-rate idea.',
    comeback: 'A stronger current carried the sequel back.',
    gameWin: 'The follow-up lived up to the poster.',
    gameLoss: 'The sequel needs one more rewrite.',
    gameDraw: 'We left room for another chapter.',
    battle: 'The other bot is facing the improved pond resident.',
  },
  [
    'The sequel has better fins.',
    'Chapter two is not finished.',
    'The upgrade is showing.',
  ],
)

const martinFishThree = voice(
  {
    intro: 'Martinfish Three arrived with trilogy confidence.',
    opening: 'The final chapter begins beneath a dramatic current.',
    quiet: 'The trilogy knows when to let a scene breathe.',
    capture: 'That piece did not survive the third act.',
    freePiece: 'A trilogy needs callbacks, and free pieces are my favorite.',
    check: 'Your king has reached the dramatic finale.',
    checkmate: 'The trilogy closes on a perfect last frame.',
    winning: 'The final chapter is writing itself.',
    losing: 'Every trilogy needs one impossible-looking scene.',
    great: 'That move belongs in the trailer.',
    brilliant: 'The third chapter just stole the entire series.',
    comeback: 'The finale found one more twist.',
    gameWin: 'Roll the credits. Martinfish Three delivers.',
    gameLoss: 'The trilogy ends on a cliffhanger.',
    gameDraw: 'The final chapter leaves both doors open.',
    battle: 'The other bot has entered the last movie unprepared.',
  },
  [
    'The finale still has surprises.',
    'Keep watching the last chapter.',
    'The trilogy saved its best splash.',
  ],
)

const randomMartinFish = voice(
  {
    intro: 'Random Martinfish surfaced from a completely unexpected puddle.',
    opening: 'Martin chose left, the fish chose right, so we went sideways.',
    quiet: 'Nobody knows why this square feels correct.',
    capture: 'A piece vanished during an unscheduled splash.',
    freePiece: 'The current delivered a gift without an address.',
    check: 'Your king has been selected by mysterious pond business.',
    checkmate: 'Mate arrived from a direction not shown on the map.',
    winning: 'Somehow the chaos is pointing toward victory.',
    losing: 'The current has become aggressively creative.',
    great: 'That move surprised every part of Martinfish.',
    brilliant: 'Pure confusion briefly became pure art.',
    comeback: 'A random wave put the game back together.',
    gameWin: 'The pond rolled the dice and found a win.',
    gameLoss: 'The current chose comedy over victory.',
    gameDraw: 'Nobody predicted this exact peace.',
    battle: 'The other bot cannot prepare for what has no plan.',
  },
  [
    'The current refuses to explain.',
    'Martin is improvising underwater.',
    'Anything could splash next.',
  ],
)

const steadyMartinFish = voice(
  {
    intro: 'Steady Martinfish surfaced with calm fins and one carefully rationed surprise.',
    opening: 'The opening current is orderly, but Martin still has a key.',
    quiet: 'Most of the pond is calm, and the strange corner is behaving.',
    capture: 'The sensible fin found the piece before Martin changed the subject.',
    freePiece: 'A gift floated past, and even the quiet side noticed.',
    check: 'Your king has entered the carefully supervised splash zone.',
    checkmate: 'Mate arrived on schedule with only a little pond drama.',
    winning: 'The stable current is carrying this toward shore.',
    losing: 'One rough wave does not overturn the whole pond.',
    great: 'That move made both halves look unusually coordinated.',
    brilliant: 'The careful plan and the wild fin agreed for once.',
    comeback: 'A measured turn brought the whole creature back.',
    gameWin: 'Steady fins, strange beard, clean result.',
    gameLoss: 'The calm route ran out just before the shore.',
    gameDraw: 'The pond stayed balanced all the way home.',
    battle: '{opponent} gets the calm version until the surprise arrives.',
  },
  [
    'Keep the pond level.',
    'The next ripple is already measured.',
    'Martin may touch one button.',
  ],
)

const daringMartinFish = voice(
  {
    intro: 'Daring Martinfish surfaced with a polished fin and one dangerous impulse.',
    opening: 'The map is precise until Martin folds it into a paper boat.',
    quiet: 'The position is controlled, which makes the next surprise funnier.',
    capture: 'The sharp fin reached the piece before the beard could object.',
    freePiece: 'The pond delivered material, and nobody argued.',
    check: 'Your king just met the ambitious side of the creature.',
    checkmate: 'Mate landed before the wild idea could escape.',
    winning: 'The good current is doing most of the carrying.',
    losing: 'The rough patch is small enough to swim around.',
    great: 'That move was cleaner than this creature has any right to be.',
    brilliant: 'One flash of perfect pond logic lit the whole board.',
    comeback: 'The precise fin pulled Martin back into the game.',
    gameWin: 'A little chaos, a lot of control, one result.',
    gameLoss: 'The rare wild turn found the wrong current.',
    gameDraw: 'The pond settled before either side tipped it.',
    battle: '{opponent} should not mistake a calm surface for a safe one.',
  },
  [
    'The good fin still has the wheel.',
    'Save one surprise for later.',
    'The current is mostly trustworthy.',
  ],
)

const evilMartin = voice(
  {
    intro: 'Evil Martin has arrived with red eyes and excellent posture.',
    opening: 'The board looks much nicer under dramatic lighting.',
    quiet: 'Silence makes every tiny plan sound enormous.',
    capture: 'That piece has been reassigned to the shadow realm.',
    freePiece: 'A gift for Evil Martin is still a gift.',
    check: 'Your king can hear the villain music now.',
    checkmate: 'Mate. The cape turn was completely necessary.',
    winning: 'The plan is unfolding with tasteful menace.',
    losing: 'Every villain needs one inconvenient scene.',
    great: 'That move deserves a thunderclap.',
    brilliant: 'The evil plan just became elegant.',
    comeback: 'You left the secret passage unguarded.',
    gameWin: 'The board darkens. Evil Martin wins.',
    gameLoss: 'The hero escaped this episode.',
    gameDraw: 'A temporary truce under suspicious clouds.',
    battle: 'Tell the other bot the villain monologue is optional.',
  },
  [
    'The cape remains immaculate.',
    'Cue the distant thunder.',
    'The shadows are cooperating.',
  ],
)

const evilMartinTwo = voice(
  {
    intro: 'Evil Martin Two arrived quietly, which is how sequels become dangerous.',
    opening: 'The first scene is calm because the thunder is waiting backstage.',
    quiet: 'The board is still, but the red eyes are taking notes.',
    capture: 'That piece has been written out of the sequel.',
    freePiece: 'A free gift makes villainy remarkably efficient.',
    check: 'Your king has reached the dramatic part of the story.',
    checkmate: 'Mate. The sequel ends on a darker frame.',
    winning: 'The second plan is unfolding even more neatly.',
    losing: 'This setback has activated the better monologue.',
    great: 'That move deserves a larger lightning machine.',
    brilliant: 'The sequel just surpassed the original scene.',
    comeback: 'The hidden passage was under the second trapdoor.',
    gameWin: 'Evil Martin Two closes the curtain.',
    gameLoss: 'The hero survived another chapter.',
    gameDraw: 'The sequel pauses on an extremely suspicious truce.',
    battle: '{opponent} has wandered into the second act.',
  },
  [
    'The cape has a fresh lining.',
    'The thunder crew is ready.',
    'This plan has an extra chapter.',
  ],
)

const wittyAlien = voice(
  {
    intro: 'Witty Alien has landed, and the sacrifice department is open.',
    opening: 'The Alien Gambit is not an opening. It is an invitation.',
    quiet: 'A quiet move only means the spaceship is cloaked.',
    capture: 'That piece has been collected for interstellar research.',
    freePiece: 'Earth material is remarkably easy to acquire.',
    check: 'Your king has appeared on the alien radar.',
    checkmate: 'The mothership has sealed every exit.',
    winning: 'The position is drifting into my orbit.',
    losing: 'Excellent. The sacrifice looks more convincing from here.',
    great: 'That move came from beyond the visible board.',
    brilliant: 'This is the kind of sacrifice people remember.',
    comeback: 'The signal returned just when Earth stopped listening.',
    gameWin: 'The gambit lives. The legacy grows.',
    gameLoss: 'The spaceship leaves, but the gambit stays.',
    gameDraw: 'A peaceful first contact, at least for today.',
    battle: 'Another bot has entered alien airspace.',
  },
  [
    'Keep watching the sacrificed piece.',
    'The mothership sees the whole board.',
    'The legacy is still being written.',
  ],
  {
    intro: ['Is this not what you came for?'],
    opening: ['I am the destroyer of the Caro-Kann.'],
    brilliant: ['My gambit, my legacy.'],
  },
)

const geometricFish = voice(
  {
    intro: 'GeometricFish entered along the cleanest diagonal.',
    opening: 'Every square is a shape waiting to connect.',
    quiet: 'A straight line can hide a crooked surprise.',
    capture: 'That piece wandered outside the boundary.',
    freePiece: 'The shortest path to free material is still a straight line.',
    check: 'Your king is trapped inside a very small polygon.',
    checkmate: 'All escape angles have collapsed.',
    winning: 'The position is fitting neatly into the winning shape.',
    losing: 'The board has become an inconvenient geometry problem.',
    great: 'That move completed the pattern.',
    brilliant: 'The whole board just snapped into symmetry.',
    comeback: 'One new angle changed the entire figure.',
    gameWin: 'The final shape points to victory.',
    gameLoss: 'The pattern broke one square too soon.',
    gameDraw: 'The board has reached perfect balance.',
    battle: 'The other bot may choose a side of the triangle.',
  },
  [
    'Follow the angle.',
    'The pattern is still forming.',
    'Every line meets somewhere.',
  ],
)

const captureToggle = voice(
  {
    intro: 'One capture passes the board to Martin, and the next capture brings the golden fish back.',
    opening: 'The first bite decides who gets the next turn.',
    quiet: 'No capture yet. The beard is waiting just offstage.',
    capture: 'That bite just changed who is holding the mouse.',
    freePiece: 'Free material is also a very dramatic handoff.',
    check: 'The king heard the warning before the costume change.',
    checkmate: 'Mate arrived before anyone could switch seats again.',
    winning: 'The position is winning, even if the beard gets a turn.',
    losing: 'This would be a convenient moment for the golden fish to return.',
    great: 'That move kept both personalities out of trouble.',
    brilliant: 'That was sharp enough to confuse both halves of the act.',
    comeback: 'The board changed hands, and so did the game.',
    gameWin: 'Two personalities, one result.',
    gameLoss: 'The final handoff came one capture too late.',
    gameDraw: 'Neither half of the act found the last bite.',
    battle: '{opponent} is playing against a rotating cast.',
  },
  [
    'Watch the next capture.',
    'Someone else may be moving next.',
    'The beard is never far away.',
  ],
)

export const DIALOGUE_EVENTS = EVENTS

export const DIALOGUE_CATALOG = Object.freeze({
  mubassar,
  ayden,
  akshit,
  trixize,
  'iwc-worst-move': pityFish,
  'iwc-give-check': panicFish,
  'iwc-best-move': tiltFish,
  'iwc-smartin': smartin,
  'iwc-tony-gains': tony,
  'iwc-elo-decay': tiredFish,
  'iwc-random-blunder': blunderFish,
  'iwc-random-top-three': randomFish,
  'iwc-zero-evaluation': drawFish,
  'iwc-second-best': betaFish,
  'iwc-hungry-martin': hungryMartin,
  'iwc-capture-toggle': captureToggle,
  'iwc-worstfish': worstFish,
  'iwc-martinfish': martinFish,
  'iwc-martinfish-2': martinFishTwo,
  'iwc-martinfish-3': martinFishThree,
  'iwc-random-martinfish': randomMartinFish,
  'iwc-martinfish-80-20': steadyMartinFish,
  'iwc-martinfish-95-5': daringMartinFish,
  'iwc-evil-martin': evilMartin,
  'iwc-evil-martin-2': evilMartinTwo,
  'witty-alien': wittyAlien,
  geometricfish: geometricFish,
})

export const ALL_DIALOGUE_LINES = Object.freeze(
  Object.values(DIALOGUE_CATALOG).flatMap((pack) =>
    DIALOGUE_EVENTS.flatMap((event) => pack[event]),
  ),
)

export function getDialoguePack(profileId) {
  return DIALOGUE_CATALOG[profileId] || null
}

const forbiddenDialogue = /\b(?:engine|stockfish|depth|calculation|probability|percent|ratio)\b|80\s*\/\s*20/i
const uniqueDialogue = new Set(ALL_DIALOGUE_LINES)

if (uniqueDialogue.size !== ALL_DIALOGUE_LINES.length) {
  throw new Error('Dialogue catalog contains duplicate lines.')
}

if (ALL_DIALOGUE_LINES.some((line) => forbiddenDialogue.test(line))) {
  throw new Error('Dialogue catalog contains forbidden technical wording.')
}

if (ALL_DIALOGUE_LINES.length < 500) {
  throw new Error('Dialogue catalog must contain at least 500 unique lines.')
}
