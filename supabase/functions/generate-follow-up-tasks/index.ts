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
    const { questions, answers, title, lang } = await req.json();

    if (!questions || !answers) {
      return new Response(JSON.stringify({ error: "questions and answers are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MISTRAL_API_KEY = Deno.env.get("MISTRAL_API_KEY");
    if (!MISTRAL_API_KEY) {
      throw new Error("MISTRAL_API_KEY is not configured");
    }

    const summary = questions.map((q: string, i: number) => {
      const ans = answers[String(i)];
      const label = ans === "yes" ? "Да/Знаю" : ans === "unsure" ? "Не уверен" : "Нет/Не знаю";
      return `${i + 1}. ${q} → ${label}`;
    }).join("\n");

    const isCyrillic = /[а-яА-ЯёЁ]/.test(title || "");
    const langHint = (lang === "ru" || isCyrillic)
      ? "Отвечай на русском языке."
      : "Antworte auf Deutsch.";

    const systemPrompt = `Ты — помощник учителя. Твоя главная цель — определить ГРАНИЦУ ЗНАНИЙ ученика по теме "${title || "неизвестная тема"}".
Граница знаний — это точка, где ученик переходит от уверенного владения материалом к затруднениям.

Ученик прошёл диагностический опрос. Ниже его ответы (Да = знает, Не уверен = сомневается, Нет = не знает).

Составь ровно 4 задачи (не вопросы, а практические упражнения), которые помогут точно определить границу его знаний:
- Задача 1: на уровне того, что ученик уверенно знает (проверка базы).
- Задача 2: на уровне чуть выше уверенных знаний (проверка нижней границы).
- Задача 3: на уровне его зоны неуверенности (проверка средней границы).
- Задача 4: на уровне выше зоны неуверенности (проверка верхней границы).
- Опирайся на слабые места (ответы "Нет" и "Не уверен"), но учитывай и сильные стороны для калибровки.
- Формулируй задачи конкретно, с числами или примерами, чтобы ученик мог решить их.

${langHint}

Выдавай ответ строго в JSON: {"tasks": ["задача1", "задача2", "задача3", "задача4"]}`;

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
          { role: "user", content: summary },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Mistral API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: `Mistral API error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
    console.error("generate-follow-up-tasks error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
