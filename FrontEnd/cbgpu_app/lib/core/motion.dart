import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Same bezier as the web app's --ease-spring token (globals.css:
/// cubic-bezier(0.34, 1.56, 0.64, 1)) — the slight overshoot is what makes
/// Toss-style UI feel tactile instead of mechanical. Flutter's default page
/// transitions use standard easeInOut, which is exactly the "too linear"
/// feel this replaces everywhere a route change happens.
const springCurve = Cubic(0.34, 1.56, 0.64, 1);

/// A route transition using springCurve instead of go_router's default,
/// matching the web app's `animate-in fade-in slide-in-from-bottom-2
/// duration-500 ease-[var(--ease-spring)]` pattern used on page entry.
CustomTransitionPage<T> springPage<T>({required GoRouterState state, required Widget child}) {
  return CustomTransitionPage<T>(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 400),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(parent: animation, curve: springCurve);
      return FadeTransition(
        opacity: animation,
        child: SlideTransition(
          position: Tween<Offset>(begin: const Offset(0, 0.04), end: Offset.zero).animate(curved),
          child: child,
        ),
      );
    },
  );
}

/// Wraps a card/button with the web's `.tilt-3d` press feedback and the
/// global `button:active` 3D press (globals.css) — a quick scale-down on
/// tap-down that springs back on release. Flutter has no `:hover`/`:active`
/// CSS equivalent, so this is triggered by the touch/tap gesture instead.
class TiltPress extends StatefulWidget {
  const TiltPress({
    super.key,
    required this.child,
    this.onTap,
    this.scale = 0.97,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double scale;

  @override
  State<TiltPress> createState() => _TiltPressState();
}

class _TiltPressState extends State<TiltPress> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (_pressed != value) setState(() => _pressed = value);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => _setPressed(true),
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      child: AnimatedScale(
        scale: _pressed ? widget.scale : 1.0,
        duration: const Duration(milliseconds: 120),
        curve: springCurve,
        child: widget.child,
      ),
    );
  }
}

/// One list item's entrance transition for `StaggeredFadeIn.item` — mirrors
/// the web's `animate-in fade-in slide-in-from-bottom-2 duration-300
/// fill-mode-backwards` plus a per-index `animationDelay`.
class StaggeredFadeIn extends StatefulWidget {
  const StaggeredFadeIn({super.key, required this.index, required this.child});

  final int index;
  final Widget child;

  @override
  State<StaggeredFadeIn> createState() => _StaggeredFadeInState();
}

class _StaggeredFadeInState extends State<StaggeredFadeIn>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 300),
  );

  @override
  void initState() {
    super.initState();
    final delayMs = (widget.index.clamp(0, 10)) * 30;
    Future.delayed(Duration(milliseconds: delayMs), () {
      if (mounted) _controller.forward();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final curved = CurvedAnimation(parent: _controller, curve: springCurve);
    return FadeTransition(
      opacity: _controller,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(0, 0.08),
          end: Offset.zero,
        ).animate(curved),
        child: widget.child,
      ),
    );
  }
}
