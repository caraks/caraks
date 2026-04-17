import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const { topic, lecture, count, language } = await req.json();
    const langCode = (language === "de" || language === "en" || language === "ru") ? language : "ru";
    const langName = langCode === "de" ? "немецком" : langCode === "en" ? "английском" : "русском";
    if (!topic) {
      return new Response(JSON.stringify({ error: "topic is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) {
      throw new Error("MISTRAL_API_KEY is not configured");
    }

    const n = Math.max(2, Math.min(10, Number(count) || 5));

    const systemPrompt = `Ты опытный учитель. Составь ${n} практических заданий для учеников по теме "${topic}".
Задания:
- Должны опираться на материал лекции (если он передан)
- Быть конкретными, с числами/примерами, чтобы их можно было решить
- Идти от простого к сложному
- Быть на русском языке

Выдавай ответ строго в JSON: {"tasks": ["задание1", "задание2", ...]}`;

    const userContent = lecture
      ? `Тема: ${topic}\n\nКонспект лекции:\n${lecture}`
      : `Тема: ${topic}`;

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-medium-latest",
        temperature: 0.7,
        max_tokens: 2048,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const t = await response.text();
      console.error("Mistral error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    let tasks: string[] = [];
    try {
      const parsed = JSON.parse(content);
      tasks = parsed.tasks || [];
    } catch {
      tasks = [content];
    }

    return new Response(JSON.stringify({ tasks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-lesson-tasks error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
