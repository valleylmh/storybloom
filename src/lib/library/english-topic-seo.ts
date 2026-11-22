import { breadcrumbs } from "@/lib/seo";
import { toAbsoluteAppUrl } from "@/lib/site-url";
import { bookEnglishTitle } from "./english-titles";
import {
  englishTopicPath,
  getEnglishTopicBooks,
  type EnglishLibraryTopic,
} from "./english-topics";
import { libraryBookPath } from "./paths";

export function englishTopicStructuredData(topic: EnglishLibraryTopic) {
  const books = getEnglishTopicBooks(topic);
  const url = toAbsoluteAppUrl(englishTopicPath(topic));
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        url,
        name: topic.heading,
        description: topic.description,
        inLanguage: "en",
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: books.length,
          itemListElement: books.map(({ book }, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: bookEnglishTitle(book),
            url: toAbsoluteAppUrl(libraryBookPath(book, "en")),
          })),
        },
      },
      {
        "@type": "FAQPage",
        url: `${url}#faq`,
        mainEntity: topic.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
      breadcrumbs([
        { name: "Home", path: "/en" },
        { name: "Picture Book Library", path: "/en/library" },
        { name: "Bilingual Collections", path: "/en/library/topics" },
        { name: topic.name, path: englishTopicPath(topic) },
      ]),
    ],
  };
}
