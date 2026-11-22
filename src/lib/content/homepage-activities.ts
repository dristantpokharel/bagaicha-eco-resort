type HomepageActivity = {
  showOnHomepage: boolean;
  homepageOrder: number;
  title: string;
  hasPlaceholder: boolean;
  cover: unknown | null;
};

/** Selects homepage activities without depending on their Explore group. */
export function selectHomepageActivities<T extends HomepageActivity>(activities: T[], allowMissingPhoto = false): T[] {
  return activities
    .filter((activity) => activity.showOnHomepage && !activity.hasPlaceholder && (allowMissingPhoto || activity.cover !== null))
    .sort((a, b) => a.homepageOrder - b.homepageOrder || a.title.localeCompare(b.title))
    .slice(0, 4);
}
