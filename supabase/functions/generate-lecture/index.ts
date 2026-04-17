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
    const { pollQuestion, quizQuestions, options, freeTextAnswers, topic, language } = await req.json();
    const langCode = (language === "de" || language === "en" || language === "ru") ? language : "ru";
    const langName = langCode === "de" ? "немецком" : langCode === "en" ? "английском" : "русском";

    const subject = topic || pollQuestion;
    if (!subject) {
      return new Response(JSON.stringify({ error: "topic is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) {
      throw new Error("MISTRAL_API_KEY is not configured");
    }

    let resultsSummary = `Тема: "${subject}"\n\n`;

    if (quizQuestions && Array.isArray(quizQuestions) && quizQuestions.length > 0) {
      resultsSummary += `Результаты диагностики учеников:\n`;
      for (const q of quizQuestions) {
        resultsSummary += `- "${q.question}": Да — ${q.yes}, Не уверен — ${q.not_sure}, Нет — ${q.no}\n`;
      }
    }

    if (options && Array.isArray(options) && options.length > 0) {
      resultsSummary += `\nРезультаты голосования:\n`;
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

    const systemPrompt = `Ты опытный учитель. Создай подробный, структурированный конспект лекции по заданной теме.
Конспект должен:
- Полностью раскрывать тему
- Быть структурированным с заголовками (markdown) и пунктами
- Содержать определения, примеры и пояснения
- Если есть результаты диагностики — учитывай слабые места учеников
- Быть написан на ${langName} языке, в формате Markdown`;

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
