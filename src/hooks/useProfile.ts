import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useProfile = () => {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      setDisplayName(data?.display_name ?? user.email ?? null);
      setLoading(false);
    };
    fetch();
  }, []);

  return { displayName, loading };
};
