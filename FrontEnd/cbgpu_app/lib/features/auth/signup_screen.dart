import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/glass.dart';
import '../../core/student_id.dart';
import '../../core/theme.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _nameController = TextEditingController();
  final _studentIdController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSubmitting = false;
  bool _confirmationSent = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _studentIdController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleSignup() async {
    if (!isValidStudentId(_studentIdController.text)) {
      setState(() => _error = '학번 형식이 올바르지 않습니다. $studentIdHint');
      return;
    }
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      // profiles row is created server-side by a Postgres trigger reading this
      // metadata (see supabase_account_management_migration.sql) — same as the
      // web app, so signup works whether or not email confirmation is pending.
      final response = await Supabase.instance.client.auth.signUp(
        email: _emailController.text.trim(),
        password: _passwordController.text,
        data: {
          'full_name': _nameController.text.trim(),
          'student_id': _studentIdController.text.trim(),
        },
      );
      if (response.session == null) {
        setState(() => _confirmationSent = true);
      }
      // else: session exists already (email confirmation disabled) — router redirect handles it.
    } on AuthException catch (e) {
      setState(() => _error = '회원가입 실패: ${e.message}');
    } catch (e) {
      setState(() => _error = '오류가 발생했습니다.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_confirmationSent) {
      return AmbientBackground(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: GlassCard(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.mark_email_read_outlined, size: 56),
                  const SizedBox(height: 16),
                  const Text('이메일을 확인해주세요', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 22)),
                  const SizedBox(height: 8),
                  Text('${_emailController.text}로 인증 메일을 보냈습니다.', textAlign: TextAlign.center),
                  const SizedBox(height: 24),
                  TextButton(onPressed: () => context.go('/login'), child: const Text('로그인으로 이동')),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return AmbientBackground(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: GlassCard(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'JOIN CBGPU',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w900,
                          fontStyle: FontStyle.italic,
                          letterSpacing: -0.5,
                        ),
                  ),
                  const SizedBox(height: 32),
                  const FieldLabel('이름 (Name)'),
                  TextField(controller: _nameController, style: const TextStyle(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  const FieldLabel('학번 (Student ID)'),
                  TextField(
                    controller: _studentIdController,
                    keyboardType: TextInputType.number,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(4)],
                    style: const TextStyle(fontWeight: FontWeight.bold),
                    decoration: const InputDecoration(hintText: '2309'),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4, left: 4),
                    child: Text(studentIdHint, style: TextStyle(fontSize: 10, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5))),
                  ),
                  const SizedBox(height: 16),
                  const FieldLabel('Email'),
                  TextField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  const FieldLabel('Password'),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                    onSubmitted: (_) => _handleSignup(),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error, fontWeight: FontWeight.bold)),
                  ],
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _isSubmitting ? null : _handleSignup,
                    child: Text(_isSubmitting ? 'CREATING...' : 'SIGN UP'),
                  ),
                  const SizedBox(height: 20),
                  TextButton(
                    onPressed: () => context.go('/login'),
                    child: const Text('이미 계정이 있으신가요? 로그인'),
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
