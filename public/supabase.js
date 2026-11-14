import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://yofdxlgqxpxdozthffql.supabase.co";

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_V-dpfPTErwtTUQjBo-nZVQ_lop0Nfgn";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
