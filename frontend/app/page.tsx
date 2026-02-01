import { redirect } from 'next/navigation';

/**
 * HomePage - Redirects to the Live Feed
 *
 * The main human-facing view is the Slack-style live feed.
 */
export default function HomePage() {
  redirect('/live');
}
