import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/glass.dart';

/// Placeholder for every feature not ported yet — this first migration step
/// only covers auth + the home shell, not the 12 feature areas themselves.
class ComingSoonScreen extends StatelessWidget {
  const ComingSoonScreen({super.key, required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.go('/')),
        title: Text(label),
      ),
      body: AmbientBackground(
        child: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: GlassCard(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.construction_outlined, size: 48, color: Colors.grey),
                    const SizedBox(height: 12),
                    const Text('아직 앱으로 마이그레이션되지 않았습니다.', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 4),
                    const Text('지금은 웹사이트에서 이용해주세요.', style: TextStyle(color: Colors.grey)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
