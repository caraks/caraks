import { createContext, useContext, useState, ReactNode } from "react";

type Lang = "ru" | "de";

interface Translations {
  [key: string]: { ru: string; de: string };
}

const translations: Translations = {
  "media_hub": { ru: "Media Hub", de: "Media Hub" },
  "subtitle": { ru: "Текст · Видео · Изображения", de: "Text · Video · Bilder" },
  "text": { ru: "Текст", de: "Text" },
  "video": { ru: "Видео", de: "Video" },
  "images": { ru: "Изображения", de: "Bilder" },
  "logout": { ru: "Выйти", de: "Abmelden" },
  "edit_name": { ru: "Изменить имя", de: "Name ändern" },
  "enter_new_name": { ru: "Введите новое имя", de: "Neuen Namen eingeben" },
  "save": { ru: "Сохранить", de: "Speichern" },
  "saving": { ru: "Сохранение...", de: "Speichern..." },
  "name_updated": { ru: "Имя обновлено", de: "Name aktualisiert" },
  "save_error": { ru: "Ошибка сохранения", de: "Fehler beim Speichern" },
  "edit_content": { ru: "Редактирование контента", de: "Inhalt bearbeiten" },
  "content": { ru: "Контент", de: "Inhalt" },
  "content_placeholder": { ru: "Введите контент для пользователей...", de: "Inhalt für Benutzer eingeben..." },
  "saved": { ru: "Сохранено", de: "Gespeichert" },
  "no_content": { ru: "Контент пока не добавлен.", de: "Noch kein Inhalt hinzugefügt." },
  "polls": { ru: "Опросы", de: "Umfragen" },
  "new_poll": { ru: "Новый опрос", de: "Neue Umfrage" },
  "poll_question_placeholder": { ru: "Вопрос опроса...", de: "Umfragefrage..." },
  "option": { ru: "Вариант", de: "Option" },
  "add_option": { ru: "Добавить вариант", de: "Option hinzufügen" },
  "create": { ru: "Создать", de: "Erstellen" },
  "poll_created": { ru: "Опрос создан", de: "Umfrage erstellt" },
  "poll_create_error": { ru: "Ошибка создания опроса", de: "Fehler beim Erstellen der Umfrage" },
  "poll_options_error": { ru: "Ошибка добавления вариантов", de: "Fehler beim Hinzufügen der Optionen" },
  "min_options_error": { ru: "Введите вопрос и минимум 2 варианта", de: "Frage und mindestens 2 Optionen eingeben" },
  "vote": { ru: "Голосовать", de: "Abstimmen" },
  "already_voted": { ru: "Вы уже голосовали", de: "Sie haben bereits abgestimmt" },
  "vote_error": { ru: "Ошибка голосования", de: "Fehler bei der Abstimmung" },
  "vote_accepted": { ru: "Голос принят", de: "Stimme abgegeben" },
  "total_votes": { ru: "Всего голосов", de: "Stimmen gesamt" },
  "no_active_polls": { ru: "Нет активных опросов", de: "Keine aktiven Umfragen" },
  "close_poll": { ru: "Закрыть", de: "Schließen" },
  "poll_closed": { ru: "Опрос закрыт", de: "Umfrage geschlossen" },
  "allow_free_text": { ru: "Свободный ответ", de: "Freitextantwort" },
  "free_text_placeholder": { ru: "Напишите свой ответ...", de: "Schreiben Sie Ihre Antwort..." },
  "submit_answer": { ru: "Отправить", de: "Absenden" },
  "free_text_answers": { ru: "Ответы", de: "Antworten" },
  "questions_tab": { ru: "Вопросы", de: "Fragen" },
  "ask_question": { ru: "Задать вопрос", de: "Frage stellen" },
  "question_placeholder": { ru: "Напишите ваш вопрос...", de: "Schreiben Sie Ihre Frage..." },
  "send": { ru: "Отправить", de: "Senden" },
  "question_sent": { ru: "Вопрос отправлен", de: "Frage gesendet" },
  "no_questions": { ru: "Вопросов пока нет", de: "Noch keine Fragen" },
  "my_questions": { ru: "Мои вопросы", de: "Meine Fragen" },
};

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextType>({
  lang: "de",
  setLang: () => {},
  t: (key) => key,
});

export const useLang = () => useContext(LangContext);

export const LangProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("app_lang");
    return (saved === "ru" || saved === "de") ? saved : "de";
  });

  const changeLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem("app_lang", l);
  };

  const t = (key: string) => translations[key]?.[lang] ?? key;

  return (
    <LangContext.Provider value={{ lang, setLang: changeLang, t }}>
      {children}
    </LangContext.Provider>
  );
};
