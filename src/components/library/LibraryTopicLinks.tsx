import Link from "next/link";
import { topicPath, type LibraryTopic } from "@/lib/library/topics";
import styles from "./LibraryTopicLinks.module.css";

export default function LibraryTopicLinks({
  topics,
  label,
  showAll = false,
}: {
  topics: LibraryTopic[];
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
            <Link href={topicPath(topic)}>{topic.name}</Link>
          </li>
        ))}
        {showAll ? (
          <li>
            <Link href="/library/topics" className={styles.all}>全部专题 →</Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
