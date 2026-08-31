import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/glass.dart';
import '../../core/theme.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _passwordController = TextEditingController();
  final _confirmationController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmationController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_passwordController.text.length < 6) {
      setState(() => _error = '비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (_passwordController.text != _confirmationController.text) {
      setState(() => _error = '비밀번호가 일치하지 않습니다.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.updateUser(
        UserAttributes(password: _passwordController.text),
      );
      await Supabase.instance.client.auth.signOut();
      if (mounted) context.go('/auth/login');
    } on AuthException catch (error) {
      if (!mounted) return;
      final expired = error.message.toLowerCase().contains('session');
      setState(
        () => _error = expired
            ? '재설정 링크가 만료되었거나 유효하지 않습니다. 비밀번호 찾기를 다시 시도해주세요.'
            : '비밀번호 변경 실패: ${error.message}',
      );
    } catch (_) {
      if (mounted) setState(() => _error = '오류가 발생했습니다.');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AmbientBackground(
      child: Align(
        alignment: Alignment.topCenter,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 80, 16, 112),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 448),
            child: GlassCard(
              radius: 28,
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    '새 비밀번호 설정',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 30,
                      fontWeight: FontWeight.w900,
                      fontStyle: FontStyle.italic,
                      letterSpacing: -0.8,
                    ),
                  ),
                  const SizedBox(height: 24),
                  const FieldLabel('새 비밀번호'),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    autofocus: true,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                    decoration: const InputDecoration(hintText: '••••••••'),
                  ),
                  const SizedBox(height: 16),
                  const FieldLabel('새 비밀번호 확인'),
                  TextField(
                    controller: _confirmationController,
                    obscureText: true,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                    decoration: const InputDecoration(hintText: '••••••••'),
                    onSubmitted: (_) => _submit(),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    child: Text(_submitting ? '변경 중...' : '비밀번호 변경'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
