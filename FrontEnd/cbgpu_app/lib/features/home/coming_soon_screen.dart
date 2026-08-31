import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Placeholder for every feature not ported yet — this first migration step
/// only covers auth + the home shell, not the 12 feature areas themselves.
class ComingSoonScreen extends StatelessWidget {
  const ComingSoonScreen({super.key, required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.go('/')),
        title: Text(label),
      ),
      body: const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.construction_outlined, size: 48, color: Colors.grey),
              SizedBox(height: 12),
              Text('아직 앱으로 마이그레이션되지 않았습니다.', style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(height: 4),
              Text('지금은 웹사이트에서 이용해주세요.', style: TextStyle(color: Colors.grey)),
            ],
          ),
        ),
      ),
    );
  }
}
