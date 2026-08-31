import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';

const _emojis = ['🐱', '🐶', '🦊', '🐼', '🐸', '🦁', '🐯', '🦋', '🌈', '🍕', '🚀', '⚡'];

class _Card {
  _Card(this.id, this.emoji);
  final int id;
  final String emoji;
  bool flipped = false;
  bool matched = false;
}

List<_Card> _makeCards(int count) {
  final pool = _emojis.take(count).toList();
  final doubled = [...pool, ...pool]..shuffle(Random());
  return [for (var i = 0; i < doubled.length; i++) _Card(i, doubled[i])];
}

class MemoryMatchGame extends StatefulWidget {
  const MemoryMatchGame({super.key});
  @override
  State<MemoryMatchGame> createState() => _MemoryMatchGameState();
}

class _MemoryMatchGameState extends State<MemoryMatchGame> {
  List<_Card> _cards = [];
  List<int> _flipped = [];
  int _moves = 0;
  int _matched = 0;
  bool _locked = false;
  int _time = 0;
  bool _running = false;
  int _pairs = 6;
  bool _done = false;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _start([int? pairs]) {
    _timer?.cancel();
    setState(() {
      _pairs = pairs ?? _pairs;
      _cards = _makeCards(_pairs);
      _flipped = [];
      _moves = 0;
      _matched = 0;
      _locked = false;
      _time = 0;
      _running = false;
      _done = false;
    });
  }

  void _tickTimer() {
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _time++);
    });
  }

  void _flip(int i) {
    if (_locked || _done) return;
    final card = _cards[i];
    if (card.flipped || card.matched || _flipped.contains(i)) return;
    if (!_running) {
      _running = true;
      _tickTimer();
    }

    setState(() {
      card.flipped = true;
      _flipped = [..._flipped, i];
    });

    if (_flipped.length == 2) {
      _moves++;
      _locked = true;
      final a = _flipped[0], b = _flipped[1];
      if (_cards[a].emoji == _cards[b].emoji) {
        setState(() {
          _cards[a].matched = true;
          _cards[b].matched = true;
          _matched++;
          _flipped = [];
          _locked = false;
          if (_matched == _pairs) {
            _done = true;
            _running = false;
            _timer?.cancel();
          }
        });
      } else {
        Future.delayed(const Duration(milliseconds: 900), () {
          if (!mounted) return;
          setState(() {
            _cards[a].flipped = false;
            _cards[b].flipped = false;
            _flipped = [];
            _locked = false;
          });
        });
      }
    }
  }

  String _fmt(int s) => '${(s ~/ 60).toString().padLeft(2, '0')}:${(s % 60).toString().padLeft(2, '0')}';

  @override
  Widget build(BuildContext context) {
    final cols = _pairs <= 6 ? 4 : 6;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 8,
          runSpacing: 8,
          children: [
            for (final p in const [(6, 'Easy'), (8, 'Mid'), (12, 'Hard')])
              ChoiceChip(label: Text(p.$2, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900)), selected: _pairs == p.$1, onSelected: (_) => _start(p.$1)),
            Text('⏱ ${_fmt(_time)}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.grey)),
            Text('🔄 $_moves', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.grey)),
            Text('✅ $_matched/$_pairs', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: Colors.grey)),
            OutlinedButton(onPressed: () => _start(), child: const Text('Reset')),
          ],
        ),
        const SizedBox(height: 16),
        ConstrainedBox(
          constraints: BoxConstraints(maxWidth: _pairs <= 6 ? 320 : 400),
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: cols, crossAxisSpacing: 8, mainAxisSpacing: 8),
            itemCount: _cards.length,
            itemBuilder: (context, i) {
              final card = _cards[i];
              final revealed = card.flipped || card.matched;
              return GestureDetector(
                onTap: () => _flip(i),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 250),
                  transitionBuilder: (child, anim) => ScaleTransition(scale: anim, child: child),
                  child: Container(
                    key: ValueKey(revealed),
                    decoration: BoxDecoration(
                      gradient: revealed ? null : const LinearGradient(colors: [Color(0xFF3B82F6), Color(0xFF6366F1)]),
                      color: revealed ? (card.matched ? Colors.green.withValues(alpha: 0.15) : Colors.grey.withValues(alpha: 0.08)) : null,
                      borderRadius: BorderRadius.circular(10),
                      border: revealed && card.matched ? Border.all(color: Colors.green.withValues(alpha: 0.4), width: 2) : null,
                    ),
                    alignment: Alignment.center,
                    child: Text(revealed ? card.emoji : '❓', style: const TextStyle(fontSize: 22)),
                  ),
                ),
              );
            },
          ),
        ),
        if (_done) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.green.withValues(alpha: 0.1), border: Border.all(color: Colors.green.withValues(alpha: 0.3)), borderRadius: BorderRadius.circular(16)),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Text('🎉 클리어!', style: TextStyle(color: Colors.green, fontWeight: FontWeight.w900, fontSize: 16)),
              Text('${_fmt(_time)} · $_moves회 시도', style: const TextStyle(fontSize: 11, color: Colors.grey)),
              const SizedBox(height: 8),
              ElevatedButton(onPressed: () => _start(), child: const Text('다시 하기')),
            ]),
          ),
        ],
        const SizedBox(height: 8),
        const Text('카드를 탭해서 짝을 맞추세요', style: TextStyle(fontSize: 11, color: Colors.grey)),
      ],
    );
  }
}
