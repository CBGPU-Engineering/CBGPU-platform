import 'dart:async';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'eduset_login_policy.dart';

/// Isolated official login view: no CBGPU JavaScript channels or credentials.
class EdusetLoginScreen extends StatefulWidget {
  const EdusetLoginScreen({super.key, this.forceSignOut = false});
  final bool forceSignOut;
  @override
  State<EdusetLoginScreen> createState() => _EdusetLoginScreenState();
}

class _EdusetLoginScreenState extends State<EdusetLoginScreen> {
  late final WebViewController _controller;
  Timer? _timer;
  bool _loading = true, _reading = false, _done = false, _switching = false;
  late bool _needSignOut;
  String? _error;

  @override
  void initState() {
    super.initState();
    _needSignOut = widget.forceSignOut;
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            if (!request.isMainFrame) return NavigationDecision.navigate;
            final uri = Uri.tryParse(request.url);
            if (uri != null && isEdusetLoginOrigin(uri))
              return NavigationDecision.navigate;
            return NavigationDecision.prevent;
          },
          onPageStarted: (_) {
            if (mounted)
              setState(() {
                _loading = true;
                _error = null;
              });
          },
          onPageFinished: (_) async {
            if (!mounted) return;
            setState(() => _loading = false);
            if (_needSignOut) {
              _needSignOut = false;
              await _switchAccount();
              return;
            }
            await _probe();
          },
          onWebResourceError: (error) {
            if (mounted && error.isForMainFrame == true)
              setState(() {
                _loading = false;
                _error = '학교 로그인 화면에 연결하지 못했습니다. 다시 시도해 주세요.';
              });
          },
        ),
      )
      ..loadRequest(Uri.parse('https://cbsh.edu-set.com/signin'));
    _timer = Timer.periodic(
      const Duration(milliseconds: 800),
      (_) => unawaited(_probe()),
    );
  }

  Future<bool> _officialOrigin() async {
    final url = Uri.tryParse(await _controller.currentUrl() ?? '');
    return url != null && isEdusetLoginOrigin(url);
  }

  Future<void> _switchAccount() async {
    if (_switching || _done) return;
    _switching = true;
    try {
      if (await _officialOrigin()) {
        await _controller.runJavaScript(
          "if(location.origin === 'https://cbsh.edu-set.com'){localStorage.removeItem('accessToken');location.replace('/signin');}",
        );
      }
    } finally {
      _switching = false;
    }
  }

  Future<void> _probe() async {
    if (!mounted || _done || _reading || _switching || _needSignOut) return;
    _reading = true;
    try {
      if (!await _officialOrigin()) return;
      final result = await _controller.runJavaScriptReturningResult(
        "(()=>{if(location.origin !== 'https://cbsh.edu-set.com')return '';return localStorage.getItem('accessToken')||'';})()",
      );
      final token = edusetSessionCandidate(result, DateTime.now());
      if (token == null ||
          !mounted ||
          _switching ||
          _done ||
          !await _officialOrigin())
        return;
      _done = true;
      _timer?.cancel();
      if (mounted) Navigator.of(context).pop(token);
    } catch (_) {
      // Login redirects and captcha frame changes are transient; never log sessions.
    } finally {
      _reading = false;
    }
  }

  @override
  void dispose() {
    _done = true;
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('EduSet 로그인', style: TextStyle(fontSize: 17)),
          Text('cbsh.edu-set.com', style: TextStyle(fontSize: 11)),
        ],
      ),
      actions: [
        TextButton(onPressed: _switchAccount, child: const Text('다른 계정')),
      ],
      bottom: _loading
          ? const PreferredSize(
              preferredSize: Size.fromHeight(2),
              child: LinearProgressIndicator(minHeight: 2),
            )
          : null,
    ),
    body: SafeArea(
      child: _error == null
          ? WebViewWidget(controller: _controller)
          : Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_error!, textAlign: TextAlign.center),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () {
                        setState(() => _error = null);
                        _controller.loadRequest(
                          Uri.parse('https://cbsh.edu-set.com/signin'),
                        );
                      },
                      child: const Text('다시 열기'),
                    ),
                  ],
                ),
              ),
            ),
    ),
  );
}
