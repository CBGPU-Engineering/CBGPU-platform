import 'package:flutter/material.dart';
import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/alarm_service.dart';
import 'core/home_widgets.dart';
import 'core/supabase_config.dart';
import 'core/theme.dart';
import 'core/theme_controller.dart';
import 'core/webview_shell.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Match the React routes exactly so recovery links and refreshed nested
  // pages do not get reinterpreted as /#/ routes by the web build.
  usePathUrlStrategy();
  await Supabase.initialize(
    url: SupabaseConfig.url,
    publishableKey: SupabaseConfig.anonKey,
  );
  await initializeHomeWidgets();
  await AlarmService.instance.init();
  runApp(const CbgpuApp());
}

/// The app is a thin native shell around the deployed web app: real UI lives
/// at cbgpu.vercel.app inside a WebView, and this shell's only job is the
/// alarm "connector" the web page can't do on its own — see
/// core/webview_shell.dart for the JS bridge and core/alarm_service.dart for
/// the local notification scheduling it drives.
class CbgpuApp extends StatelessWidget {
  const CbgpuApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<ThemeMode>(
      valueListenable: themeModeNotifier,
      builder: (context, mode, _) => MaterialApp(
        title: 'CBGPU',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light(),
        darkTheme: AppTheme.dark(),
        themeMode: mode,
        home: const WebViewShellScreen(),
      ),
    );
  }
}
