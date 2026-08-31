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
