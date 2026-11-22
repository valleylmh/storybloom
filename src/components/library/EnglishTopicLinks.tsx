import Link from "next/link";
import {
  englishTopicPath,
  type EnglishLibraryTopic,
} from "@/lib/library/english-topics";
import styles from "./LibraryTopicLinks.module.css";

export default function EnglishTopicLinks({
  topics,
  label,
  showAll = false,
}: {
  topics: EnglishLibraryTopic[];
  label: string;
  showAll?: boolean;
}) {
  if (!topics.length) return null;
  return (
    <nav className={styles.topics} aria-label={label}>
      <strong>{label}</strong>
      <ul>
        {topics.map((topic) => (
          <li key={topic.id}>
            <Link href={englishTopicPath(topic)}>{topic.name}</Link>
          </li>
        ))}
        {showAll ? (
          <li>
            <Link href="/en/library/topics" className={styles.all}>
              All collections →
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
