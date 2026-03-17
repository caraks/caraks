import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pollQuestion, options, votes, freeTextAnswers } = await req.json();

    if (!pollQuestion) {
      return new Response(JSON.stringify({ error: "pollQuestion is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) {
      throw new Error("MISTRAL_API_KEY is not configured");
    }

    // Build a summary of poll results
    let resultsSummary = `Тема опроса: "${pollQuestion}"\n\nРезультаты голосования:\n`;
    if (options && Array.isArray(options)) {
      for (const opt of options) {
        resultsSummary += `- "${opt.text}": ${opt.count} голосов\n`;
      }
    }
    if (freeTextAnswers && freeTextAnswers.length > 0) {
      resultsSummary += `\nСвободные ответы учеников:\n`;
      for (const ans of freeTextAnswers) {
        resultsSummary += `- ${ans}\n`;
      }
    }

    const systemPrompt = `Ты опытный учитель. На основе темы опроса и ответов учеников создай подробный, структурированный конспект лекции.
Конспект должен:
- Раскрывать тему, указанную в опросе
- Учитывать ответы и уровень понимания учеников (на основе их голосов и свободных ответов)
- Быть структурированным с заголовками и пунктами
- Содержать примеры и пояснения
- Быть на русском языке`;

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-medium-latest",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: resultsSummary },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Слишком много запросов, попробуйте позже." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("Mistral error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const lecture = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ lecture }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lecture error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
