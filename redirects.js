const redirects = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header',
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  // Old page slugs: "töötab" lost its "ö"s before Estonian letters were transliterated,
  // and "Meist" had a truncated slug.
  const oldSlugRedirects = [
    {
      destination: '/kuidas-see-tootab',
      permanent: true,
      source: '/kuidas-see-ttab',
    },
    {
      destination: '/meist',
      permanent: true,
      source: '/m',
    },
  ]

  // The Demo page was a single screen recording; the video now lives on "Kuidas see töötab".
  const removedPageRedirects = [
    {
      destination: '/kuidas-see-tootab',
      permanent: true,
      source: '/demo',
    },
  ]

  const redirects = [internetExplorerRedirect, ...oldSlugRedirects, ...removedPageRedirects]

  return redirects
}

export default redirects
