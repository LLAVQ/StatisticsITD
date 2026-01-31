# StatisticsИТД (Statistics ITD)

Tampermonkey userscript for **итд.com** that shows detailed account statistics on any user profile page: likes, posts, views, reposts, engagement, growth, and management metrics in a **draggable floating panel** with interactive charts.

## Features

- **Floating draggable window** — drag by the header to move; hide/show via a separate toggle button
- **Profile stats** — followers, following, posts count, account age
- **Content stats** — total likes, views, comments, reposts (from recent posts)
- **Interactive charts** — engagement breakdown (pie), post performance (bar), views rank
- **Growth tracking** — compare with last saved snapshot (stored in localStorage)
- **Post rank by views** — table of recent posts sorted by views
- **Management metrics** — engagement rate, avg views per post, best/worst post, growth %

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Chrome, Firefox, Edge).
2. Open **statistics-itd.user.js** and copy its full content, or use Tampermonkey → Create new script → paste.
3. Save. The script runs on `https://xn--d1ah4a.com/*` (итд.com).

## Usage

1. Open any **user profile page** on итд.com (e.g. `https://xn--d1ah4a.com/profile/username`).
2. A **toggle button** appears (e.g. bottom-right): click to show/hide the stats panel.
3. The **stats panel** shows:
   - Summary numbers (followers, posts, total likes/views/reposts/comments)
   - Charts (engagement distribution, post views rank)
   - Growth vs last snapshot (if you’ve opened the panel before)
   - Post rank table (recent posts by views)
4. **Drag** the panel by its header to reposition.
5. **Save snapshot** to track growth over time (button in panel).

## API

The script uses the same public API as the site:

- `GET /api/users/{username}` — profile (followersCount, followingCount, postsCount, createdAt)
- `GET /api/posts/user/{username}?limit=50&sort=new` — recent posts (likesCount, viewsCount, commentsCount, repostsCount)

No auth required for viewing public profiles and posts.

## New repo

To use this as a separate repo named **StatisticsИТД**:

```bash
cp -r StatisticsITD /path/to/StatisticsITD
cd /path/to/StatisticsITD
git init
git add .
git commit -m "Initial commit: Statistics ITD Tampermonkey script"
# then create repo on GitHub/GitLab and push
```

## License

MIT
