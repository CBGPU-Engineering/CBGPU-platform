import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'alarm_service.dart';
import 'home_widgets.dart';
import 'push_notifications.dart';
import 'supabase_config.dart';

const _siteUrl = 'https://cbgpu.vercel.app/';
const _siteHost = 'cbgpu.vercel.app';
const _bridgeChannel = 'CBGPUNativeChannel';

/// Tags every URL we load with `?native=1` so the site can tell it's running
/// inside this app from its very first synchronous render — before the JS
/// bridge script even gets injected (that only happens once the page finishes
/// loading). Without this hint, the site had no fast way to know "wait for a
/// possible native session restore" vs. "this browser really has no session",
/// so it would flash (or get stuck on) a "please log in" screen while the
/// getPersistedSession fallback was still in flight.
Uri _withNativeFlag(Uri uri) {
  return uri.replace(queryParameters: {...uri.queryParameters, 'native': '1'});
}

/// Injected into the page once it finishes loading. Gives the web app a
/// promise-based `window.CBGPUNative` bridge into the native alarm layer —
/// the "connector" between the webview and Supabase-backed alarm scheduling
/// that plain web/PWA notifications can't do reliably (especially on iOS,
/// and on Android once the page/tab is gone from memory).
final _bridgeScript = '''
(function () {
  if (window.CBGPUNative) return;
  var pending = {};
  var seq = 0;
  function call(action, payload) {
    return new Promise(function (resolve, reject) {
      var callId = 'c' + (seq++);
      pending[callId] = { resolve: resolve, reject: reject };
      $_bridgeChannel.postMessage(JSON.stringify({
        callId: callId,
        action: action,
        payload: payload || {}
      }));
    });
  }
  window.CBGPUNative = {
    isNative: true,
    platform: '${defaultTargetPlatform.name}',
    scheduleAlarm: function (opts) { return call('scheduleAlarm', opts); },
    cancelAlarm: function (id) { return call('cancelAlarm', { id: id }); },
    cancelAllAlarms: function () { return call('cancelAllAlarms', {}); },
    listAlarms: function () { return call('listAlarms', {}); },
    requestNotificationPermission: function () {
      return call('requestNotificationPermission', {});
    },
    syncSession: function (opts) { return call('syncSession', opts); },
    clearSession: function () { return call('clearSession', {}); },
    getPersistedSession: function () { return call('getPersistedSession', {}); },
    _resolve: function (callId, ok, result) {
      var p = pending[callId];
      if (!p) return;
      delete pending[callId];
      if (ok) { p.resolve(result); } else { p.reject(result); }
    }
  };
  window.dispatchEvent(new Event('cbgpu-native-ready'));
})();
''';

/// Whether this platform has an official webview_flutter backend. Desktop
/// (Linux/Windows) doesn't — those builds fall back to opening the site in
/// the system browser instead of crashing on an unsupported platform view.
/// (Web isn't a build target for this app at all — see .metadata.)
bool get _webViewSupported =>
    defaultTargetPlatform == TargetPlatform.android ||
    defaultTargetPlatform == TargetPlatform.iOS ||
    defaultTargetPlatform == TargetPlatform.macOS;

class WebViewShellScreen extends StatefulWidget {
  const WebViewShellScreen({super.key});

  @override
  State<WebViewShellScreen> createState() => _WebViewShellScreenState();
}

class _WebViewShellScreenState extends State<WebViewShellScreen>
    with WidgetsBindingObserver {
  // Only ever read when _webViewSupported is true — see build()'s early
  // return for the unsupported-platform fallback UI.
  late final WebViewController _controller;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    if (!_webViewSupported) return;
    WidgetsBinding.instance.addObserver(this);

    // A home-widget tap that launched (rather than resumed) the app sets
    // this before this screen exists — consume it as the initial URL. A tap
    // that arrives while already running is handled by the listener below.
    final initialPath = pendingWidgetPath.value;
    pendingWidgetPath.value = null;
    pendingWidgetPath.addListener(_onPendingWidgetPath);

    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..addJavaScriptChannel(
        _bridgeChannel,
        onMessageReceived: _handleBridgeMessage,
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _loading = true),
          onPageFinished: (_) async {
            setState(() => _loading = false);
            await _controller.runJavaScript(_bridgeScript);
          },
          onNavigationRequest: _handleNavigationRequest,
        ),
      )
      ..loadRequest(
        _withNativeFlag(
          initialPath == null
              ? Uri.parse(_siteUrl)
              : Uri.parse(_siteUrl).resolve(initialPath),
        ),
      );

    // Widget data needs a Supabase session, which only arrives once the
    // page's own auth state calls the syncSession bridge action — refresh
    // now for the "already logged in, no session change coming" case too.
    unawaited(refreshAllHomeWidgets());
  }

  @override
  void dispose() {
    pendingWidgetPath.removeListener(_onPendingWidgetPath);
    if (_webViewSupported) WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(refreshAllHomeWidgets());
    }
  }

  void _onPendingWidgetPath() {
    final path = pendingWidgetPath.value;
    if (path == null) return;
    pendingWidgetPath.value = null;
    _controller.loadRequest(_withNativeFlag(Uri.parse(_siteUrl).resolve(path)));
  }

  Future<NavigationDecision> _handleNavigationRequest(
    NavigationRequest request,
  ) async {
    final uri = Uri.tryParse(request.url);
    if (uri != null && uri.host == _siteHost) {
      return NavigationDecision.navigate;
    }
    // Anything leaving the site (external links, mailto:, tel:, OAuth
    // redirects to other domains) opens outside the webview.
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    return NavigationDecision.prevent;
  }

  Future<void> _handleBridgeMessage(JavaScriptMessage message) async {
    Map<String, dynamic> decoded;
    try {
      decoded = jsonDecode(message.message) as Map<String, dynamic>;
    } catch (error) {
      debugPrint('WebViewShell: malformed bridge message: $error');
      return;
    }

    final callId = decoded['callId'] as String?;
    final action = decoded['action'] as String?;
    final payload = (decoded['payload'] as Map?)?.cast<String, dynamic>() ?? const {};
    if (callId == null || action == null) return;

    try {
      final result = await _dispatch(action, payload);
      await _resolveJs(callId, true, result);
    } catch (error) {
      await _resolveJs(callId, false, {'error': error.toString()});
    }
  }

  Future<dynamic> _dispatch(String action, Map<String, dynamic> payload) async {
    switch (action) {
      case 'scheduleAlarm':
        final whenIso = payload['whenIso'] as String?;
        final id = payload['id'] as String?;
        final title = payload['title'] as String?;
        if (whenIso == null || id == null || title == null) {
          throw ArgumentError('scheduleAlarm requires id, title, whenIso');
        }
        await AlarmService.instance.scheduleAlarm(
          id: id,
          title: title,
          body: (payload['body'] as String?) ?? '',
          when: DateTime.parse(whenIso),
          repeat: switch (payload['repeat'] as String?) {
            'daily' => AlarmRepeat.daily,
            'weekdays' => AlarmRepeat.weekdays,
            _ => AlarmRepeat.none,
          },
        );
        return {'ok': true};
      case 'cancelAlarm':
        final id = payload['id'] as String?;
        if (id == null) throw ArgumentError('cancelAlarm requires id');
        await AlarmService.instance.cancelAlarm(id);
        return {'ok': true};
      case 'cancelAllAlarms':
        await AlarmService.instance.cancelAll();
        return {'ok': true};
      case 'listAlarms':
        final alarms = await AlarmService.instance.listAlarms();
        return alarms.map((a) => a.toJson()).toList();
      case 'requestNotificationPermission':
        final granted = await AlarmService.instance.requestPermission();
        return {'granted': granted};
      case 'syncSession':
        // Hydrates the native Supabase client (used by AlarmService's
        // sibling, the home-widget refresh code) with the same session the
        // web page is already signed into — the two Supabase clients are
        // otherwise unaware of each other.
        final refreshToken = payload['refreshToken'] as String?;
        if (refreshToken == null) {
          throw ArgumentError('syncSession requires refreshToken');
        }
        await Supabase.instance.client.auth.setSession(refreshToken);
        unawaited(refreshAllHomeWidgets());
        unawaited(registerDeviceForPushNotifications());
        return {'ok': true};
      case 'clearSession':
        await Supabase.instance.client.auth.signOut();
        unawaited(refreshAllHomeWidgets());
        return {'ok': true};
      case 'getPersistedSession':
        // The website's own WebView-local session (its Supabase client's
        // localStorage) doesn't reliably survive a full app restart, but
        // this native client's session does (supabase_flutter persists it
        // itself) — this lets the page fall back to it instead of forcing
        // the user to log in again every time they reopen the app.
        //
        // Read straight from supabase_flutter's own SharedPreferences entry
        // (same key/format it uses internally — see local_storage.dart)
        // rather than `Supabase.instance.client.auth.currentSession`: that
        // getter is only populated once `Supabase.initialize()`'s session
        // recovery finishes, which runs in the background and is NOT
        // awaited before `runApp()` — so right after a cold start it's
        // frequently still null exactly when this bridge call, racing it,
        // arrives from a WebView page load that already finished.
        final prefs = await SharedPreferences.getInstance();
        final storageKey =
            'sb-${Uri.parse(SupabaseConfig.url).host.split('.').first}-auth-token';
        final raw = prefs.getString(storageKey);
        if (raw == null) return {'session': null};
        Map<String, dynamic> decoded;
        try {
          decoded = jsonDecode(raw) as Map<String, dynamic>;
        } catch (_) {
          return {'session': null};
        }
        final accessToken = decoded['access_token'] as String?;
        final refreshToken = decoded['refresh_token'] as String?;
        if (accessToken == null || refreshToken == null) {
          return {'session': null};
        }
        return {
          'session': {'accessToken': accessToken, 'refreshToken': refreshToken},
        };
      default:
        throw ArgumentError('Unknown bridge action: $action');
    }
  }

  Future<void> _resolveJs(String callId, bool ok, dynamic result) async {
    final js =
        "window.CBGPUNative && window.CBGPUNative._resolve('$callId', $ok, ${jsonEncode(result)});";
    try {
      await _controller.runJavaScript(js);
    } catch (error) {
      debugPrint('WebViewShell: failed to resolve JS callback: $error');
    }
  }

  Future<void> _openExternally() async {
    await launchUrl(Uri.parse(_siteUrl), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    if (!_webViewSupported) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  '이 플랫폼에서는 앱 내 웹뷰를 지원하지 않아요.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _openExternally,
                  child: const Text('브라우저에서 열기'),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        if (await _controller.canGoBack()) {
          await _controller.goBack();
        } else if (Platform.isAndroid) {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        body: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              if (_loading) const LinearProgressIndicator(minHeight: 2),
            ],
          ),
        ),
      ),
    );
  }
}
