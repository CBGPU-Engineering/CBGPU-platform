/// Same project as the Next.js site (FrontEnd/cbgpu) — one shared Supabase
/// backend (auth, tables, RLS, storage) behind both clients. The anon key is
/// safe to ship in the app; it's the same value already public in the
/// deployed web bundle, and every table is protected by RLS, not this key.
class SupabaseConfig {
  static const url = 'https://fclbzjlcepoaifvcoxdw.supabase.co';
  static const anonKey = 'sb_publishable_fgrXxcwq2FC-G4YWzB7Y2A_M93BlQ4X';
}
