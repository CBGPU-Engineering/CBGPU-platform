import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/glass.dart';
import '../../core/theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSubmitting = false;
  String? _error;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    setState(() {
      _isSubmitting = true;
      _error = null;
    });
    try {
      await Supabase.instance.client.auth.signInWithPassword(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );
      // go_router's redirect picks up the auth state change and navigates home.
    } on AuthException catch (e) {
      setState(() => _error = '로그인 실패: ${e.message}');
    } catch (e) {
      setState(() => _error = '오류가 발생했습니다.');
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AmbientBackground(
      child: Align(
        alignment: Alignment.topCenter,
        child: SingleChildScrollView(
          // Web layout adds main.py-10 (40) before this page's mt-20 (80).
          padding: const EdgeInsets.fromLTRB(16, 120, 16, 112),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 448),
            child: GlassCard(
              radius: 28,
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'SIGN IN',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w900,
                      fontStyle: FontStyle.italic,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 24),
                  const FieldLabel('Email'),
                  TextField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                    decoration: const InputDecoration(
                      hintText: 'your@email.com',
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const FieldLabel('Password'),
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: TextButton(
                          onPressed: () => context.go('/auth/forgot-password'),
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text(
                            '비밀번호 찾기',
                            style: TextStyle(fontSize: 11),
                          ),
                        ),
                      ),
                    ],
                  ),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                    onSubmitted: (_) => _handleLogin(),
                    decoration: const InputDecoration(hintText: '••••••••'),
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
                    onPressed: _isSubmitting ? null : _handleLogin,
                    child: Text(_isSubmitting ? 'SIGNING IN...' : 'LOGIN'),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => context.go('/auth/signup'),
                    child: const Text('No account?  Create Account'),
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
