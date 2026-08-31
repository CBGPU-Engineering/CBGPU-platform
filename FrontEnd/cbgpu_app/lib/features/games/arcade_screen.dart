import 'package:flutter/material.dart';

import '../../core/glass.dart';
import 'flappy_bird_game.dart';
import 'game_2048.dart';
import 'memory_match_game.dart';
import 'minesweeper_game.dart';
import 'poly_bridge_game.dart';
import 'snake_game.dart';
import 'tetris_game.dart';
import 'wordle_kr_game.dart';

const _games = [
  ('flappy', 'Flappy', '🐦', 'touch'),
  ('memory', 'Memory', '🧠', 'touch'),
  ('mines', 'Mines', '💣', 'touch'),
  ('wordle', 'Wordle', '🇰🇷', 'touch'),
  ('snake', 'Snake', '🐍', 'keys'),
  ('tetris', 'Tetris', '🟦', 'keys'),
  ('2048', '2048', '🔢', 'touch'),
  ('polybridge', 'PolyBridge', '🌉', 'touch'),
];

class ArcadeScreen extends StatefulWidget {
  const ArcadeScreen({super.key});
  @override
  State<ArcadeScreen> createState() => _ArcadeScreenState();
}

class _ArcadeScreenState extends State<ArcadeScreen> {
  String _active = 'flappy';

  @override
  Widget build(BuildContext context) {
    final active = _games.firstWhere((g) => g.$1 == _active);

    return AmbientBackground(
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 704),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 40, 16, 112),
            children: [
              const Text(
                'Arcade',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w900,
                  fontStyle: FontStyle.italic,
                  letterSpacing: -0.8,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'AI 학습 대기 중 한 판 하세요',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.grey,
                  fontSize: 12,
                  letterSpacing: 1.0,
                ),
              ),
              const SizedBox(height: 24),
              SizedBox(
                height: 44,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    for (final g in _games)
                      Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: ChoiceChip(
                          label: Text(
                            g.$3,
                            style: const TextStyle(fontSize: 18),
                          ),
                          selected: _active == g.$1,
                          onSelected: (_) => setState(() => _active = g.$1),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 4),
              Center(
                child: Text(
                  '${active.$2} · ${active.$4 == 'touch' ? '👆 touch' : '⌨️ keys'}',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: Colors.grey,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Center(
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: _active == 'polybridge' ? 640 : 420,
                  ),
                  child: switch (_active) {
                    'flappy' => const FlappyBirdGame(),
                    'memory' => const MemoryMatchGame(),
                    'mines' => const MinesweeperGame(),
                    'wordle' => const WordleKrGame(),
                    'snake' => const SnakeGame(),
                    'tetris' => const TetrisGame(),
                    '2048' => const Game2048(),
                    _ => const PolyBridgeGame(),
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
