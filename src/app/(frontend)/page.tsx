import PageTemplate, { generateMetadata } from './[slug]/page'

// Route segment config isn't inherited from the re-exported page; see [slug]/page.tsx.
export const dynamic = 'force-static'

export default PageTemplate

export { generateMetadata }
