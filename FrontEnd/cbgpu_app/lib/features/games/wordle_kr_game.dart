import 'dart:math';

import 'package:flutter/material.dart';

const _words = [
  '소프트웨어', '프로그래밍', '사물인터넷', '양자컴퓨팅', '자율주행차',
  '데이터분석', '충북과학고', '반도체공학', '컴퓨터비전', '딥러닝모델',
  '리눅스커널', '인터넷속도', '스마트폰앱', '로봇공학과', '나노기술학',
  '바이오기술', '화학실험실', '생물다양성', '우주탐험대', '전기자동차',
  '행복한하루', '재미있어요', '아름다워요', '즐거운시간', '맛있는음식',
  '과학기술원', '별이빛나요', '무지개색깔', '여름이좋아', '봄이왔어요',
  '인터넷뱅킹', '수학공식들', '통계학기초', '물리학법칙', '생명과학관',
  '달에가고파', '초록빛하늘', '피자먹어요', '치킨먹고파', '눈이내려요',
];

enum _Status { correct, present, absent, empty, active }

Color _bg(_Status s) => switch (s) {
      _Status.correct => const Color(0xFF22C55E),
      _Status.present => const Color(0xFFFACC15),
      _Status.absent => const Color(0x1A9CA3AF),
      _Status.empty => Colors.transparent,
      _Status.active => Colors.transparent,
    };

Color _border(_Status s) => switch (s) {
      _Status.correct => const Color(0xFF22C55E),
      _Status.present => const Color(0xFFFACC15),
      _Status.absent => Colors.grey,
      _Status.empty => Colors.grey.withValues(alpha: 0.3),
      _Status.active => Colors.blue,
    };

List<_Status> _evaluate(String guess, String answer) {
  final g = guess.split('');
  final a = answer.split('');
  final result = List.filled(5, _Status.absent);
  final used = List.filled(5, false);
  for (var i = 0; i < 5; i++) {
    if (g[i] == a[i]) {
      result[i] = _Status.correct;
      used[i] = true;
    }
  }
  for (var i = 0; i < 5; i++) {
    if (result[i] == _Status.correct) continue;
    for (var j = 0; j < 5; j++) {
      if (!used[j] && g[i] == a[j]) {
        result[i] = _Status.present;
        used[j] = true;
        break;
      }
    }
  }
  return result;
}

class WordleKrGame extends StatefulWidget {
  const WordleKrGame({super.key});
  @override
  State<WordleKrGame> createState() => _WordleKrGameState();
}

class _WordleKrGameState extends State<WordleKrGame> {
  late String _answer = _words[Random().nextInt(_words.length)];
  final List<List<String>> _rowChars = List.generate(6, (_) => List.filled(5, ''));
  final List<List<_Status>> _rowStatuses = List.generate(6, (_) => List.filled(5, _Status.empty));
  int _currentRow = 0;
  final _inputController = TextEditingController();
  String _phase = 'playing'; // playing, won, lost
  final Map<String, _Status> _charMap = {};

  static final _allChars = (_words.join('').split('').toSet().toList()..sort());

  @override
  void dispose() {
    _inputController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_phase != 'playing') return;
    final input = _inputController.text;
    final chars = input.split('');
    if (chars.length != 5 || !chars.every((c) => RegExp(r'[가-힣]').hasMatch(c))) {
      return;
    }
    final statuses = _evaluate(input, _answer);
    setState(() {
      _rowChars[_currentRow] = chars;
      _rowStatuses[_currentRow] = statuses;
      for (var i = 0; i < 5; i++) {
        final ch = chars[i];
        final prev = _charMap[ch];
        final next = statuses[i];
        if (prev == _Status.correct) continue;
        if (prev == _Status.present && next != _Status.correct) continue;
        _charMap[ch] = next;
      }
      _inputController.clear();

      if (input == _answer) {
        _phase = 'won';
      } else if (_currentRow == 5) {
        _phase = 'lost';
      } else {
        _currentRow++;
      }
    });
  }

  void _reset() {
    setState(() {
      _answer = _words[Random().nextInt(_words.length)];
      for (var i = 0; i < 6; i++) {
        _rowChars[i] = List.filled(5, '');
        _rowStatuses[i] = List.filled(5, _Status.empty);
      }
      _currentRow = 0;
      _inputController.clear();
      _phase = 'playing';
      _charMap.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text('꼬들 KR', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
        const Text('5글자 한국어 단어를 맞춰보세요 (6번 시도)', style: TextStyle(fontSize: 11, color: Colors.grey)),
        const SizedBox(height: 16),
        for (var r = 0; r < 6; r++)
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [for (var c = 0; c < 5; c++) _tile(r, c)],
            ),
          ),
        const SizedBox(height: 12),
        if (_phase == 'playing')
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 150,
                child: TextField(
                  controller: _inputController,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16),
                  decoration: const InputDecoration(hintText: '5글자 입력...'),
                  onChanged: (v) {
                    final filtered = v.split('').where((c) => RegExp(r'[가-힣]').hasMatch(c)).take(5).join();
                    if (filtered != v) {
                      _inputController.value = TextEditingValue(text: filtered, selection: TextSelection.collapsed(offset: filtered.length));
                    }
                  },
                  onSubmitted: (_) => _submit(),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(onPressed: _submit, child: const Text('확인')),
            ],
          ),
        const SizedBox(height: 12),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 4,
          runSpacing: 4,
          children: [
            for (final ch in _allChars.take(40))
              Container(
                width: 26,
                height: 26,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: _charMap[ch] != null ? _bg(_charMap[ch]!) : Colors.grey.withValues(alpha: 0.1), border: Border.all(color: _charMap[ch] != null ? _border(_charMap[ch]!) : Colors.grey.withValues(alpha: 0.2)), borderRadius: BorderRadius.circular(6)),
                child: Text(ch, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: _charMap[ch] != null ? Colors.white : Colors.grey)),
              ),
          ],
        ),
        if (_phase != 'playing') ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: (_phase == 'won' ? Colors.green : Colors.grey).withValues(alpha: 0.1), border: Border.all(color: (_phase == 'won' ? Colors.green : Colors.grey).withValues(alpha: 0.3)), borderRadius: BorderRadius.circular(16)),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              if (_phase == 'won')
                Text('🎉 정답! (${_currentRow + 1}/6)', style: const TextStyle(color: Colors.green, fontWeight: FontWeight.w900, fontSize: 16))
              else ...[
                const Text('😢 아쉽...', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
                Text.rich(TextSpan(text: '정답: ', style: const TextStyle(fontSize: 12, color: Colors.grey), children: [TextSpan(text: _answer, style: TextStyle(fontWeight: FontWeight.w900, color: Theme.of(context).colorScheme.primary))])),
              ],
              const SizedBox(height: 8),
              ElevatedButton(onPressed: _reset, child: const Text('새 단어')),
            ]),
          ),
        ],
        const SizedBox(height: 8),
        const Text('초록=정확 · 노랑=있지만 위치 다름 · 회색=없음', style: TextStyle(fontSize: 10, color: Colors.grey), textAlign: TextAlign.center),
      ],
    );
  }

  Widget _tile(int r, int c) {
    String ch;
    _Status status;
    if (r == _currentRow && _phase == 'playing') {
      final input = _inputController.text;
      ch = c < input.length ? input[c] : '';
      status = ch.isNotEmpty ? _Status.active : _Status.empty;
    } else {
      ch = _rowChars[r][c];
      status = _rowStatuses[r][c];
    }
    return Container(
      width: 44,
      height: 44,
      margin: const EdgeInsets.symmetric(horizontal: 3),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: _bg(status), border: Border.all(color: _border(status), width: 2), borderRadius: BorderRadius.circular(8)),
      child: Text(ch, style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: (status == _Status.correct || status == _Status.present) ? Colors.white : null)),
    );
  }
}
