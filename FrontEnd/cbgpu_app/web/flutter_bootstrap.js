{{flutter_js}}
{{flutter_build_config}}

// Do not let an older Flutter service worker keep serving stale Dart after a
// new release. This app is online-first and all important data already has its
// own API/cache behavior, so a stale application shell is more harmful than
// offline startup here.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) registration.unregister();
  });
}

_flutter.loader.load();
