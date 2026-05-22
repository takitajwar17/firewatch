import type { SVGProps } from 'react';

type RedditIconProps = SVGProps<SVGSVGElement>;

const RedditIcon = ({ children, ...props }: RedditIconProps) => (
  <svg
    aria-hidden="true"
    fill="currentColor"
    height="20"
    viewBox="0 0 20 20"
    width="20"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    {children}
  </svg>
);

export const RedditSearchIcon = (props: RedditIconProps) => (
  <RedditIcon {...props}>
    <path d="M18.736 17.464l-3.483-3.483A7.961 7.961 0 0016.999 9 8 8 0 109 17a7.961 7.961 0 004.981-1.746l3.483 3.483a.9.9 0 101.272-1.273zM9 15.2A6.207 6.207 0 012.8 9c0-3.419 2.781-6.2 6.2-6.2s6.2 2.781 6.2 6.2-2.781 6.2-6.2 6.2z" />
  </RedditIcon>
);

export const RedditQueueIcon = (props: RedditIconProps) => (
  <RedditIcon {...props}>
    <path d="M4.2 2h11.6A2.2 2.2 0 0118 4.2v11.6a2.2 2.2 0 01-2.2 2.2H4.2A2.2 2.2 0 012 15.8V4.2A2.2 2.2 0 014.2 2zm1.1 4.1a.9.9 0 000 1.8h9.4a.9.9 0 100-1.8H5.3zm0 3a.9.9 0 000 1.8h9.4a.9.9 0 100-1.8H5.3zm0 3a.9.9 0 000 1.8h5.9a.9.9 0 100-1.8H5.3z" />
  </RedditIcon>
);

export const RedditApproveIcon = (props: RedditIconProps) => (
  <RedditIcon {...props}>
    <path d="M7.8 14.7a.9.9 0 01-.64-.26l-3.2-3.2a.9.9 0 011.28-1.28l2.56 2.57 6.96-6.97a.9.9 0 111.28 1.28l-7.6 7.6a.9.9 0 01-.64.26z" />
  </RedditIcon>
);

export const RedditRemoveIcon = (props: RedditIconProps) => (
  <RedditIcon {...props}>
    <path d="M10 1.8a8.2 8.2 0 100 16.4 8.2 8.2 0 000-16.4zm0 1.8c1.44 0 2.78.5 3.84 1.34l-8.9 8.9A6.36 6.36 0 013.6 10 6.4 6.4 0 0110 3.6zm0 12.8a6.36 6.36 0 01-3.84-1.34l8.9-8.9A6.36 6.36 0 0116.4 10a6.4 6.4 0 01-6.4 6.4z" />
  </RedditIcon>
);

export const RedditShieldIcon = (props: RedditIconProps) => (
  <RedditIcon {...props}>
    <path d="M10 19a.9.9 0 01-.42-.1C4.9 16.5 2.5 12.85 2.5 8.05V4.5a.9.9 0 01.62-.86l6.6-2.1a.9.9 0 01.56 0l6.6 2.1a.9.9 0 01.62.86v3.55c0 4.8-2.4 8.44-7.08 10.85A.9.9 0 0110 19zM4.3 5.16v2.9c0 3.9 1.87 6.84 5.7 8.99 3.83-2.15 5.7-5.08 5.7-8.99v-2.9L10 3.35 4.3 5.16z" />
  </RedditIcon>
);

export const RedditShareIcon = (props: RedditIconProps) => (
  <RedditIcon {...props}>
    <path d="M14.7 13.1a2.7 2.7 0 00-1.88.76L7.44 10.8a2.74 2.74 0 000-1.6l5.38-3.06a2.7 2.7 0 10-.9-1.56L6.54 7.64a2.7 2.7 0 100 4.72l5.38 3.06a2.7 2.7 0 102.78-2.32z" />
  </RedditIcon>
);

export const RedditCommentIcon = (props: RedditIconProps) => (
  <RedditIcon {...props}>
    <path d="M10 2.4c4.42 0 8 2.96 8 6.62s-3.58 6.62-8 6.62c-.82 0-1.62-.1-2.37-.3l-3.38 1.9a.8.8 0 01-1.16-.88l.78-2.9C2.7 12.78 2 10.98 2 9.02 2 5.36 5.58 2.4 10 2.4zm0 1.8c-3.42 0-6.2 2.16-6.2 4.82 0 1.5.88 2.93 2.4 3.85a.9.9 0 01.4 1l-.25.93 1.82-1.02a.9.9 0 01.68-.08c.37.09.76.14 1.15.14 3.42 0 6.2-2.16 6.2-4.82S13.42 4.2 10 4.2z" />
  </RedditIcon>
);

export const RedditUpvoteIcon = (props: RedditIconProps) => (
  <RedditIcon {...props}>
    <path d="M10 2.4a1 1 0 01.73.32l6.1 6.6a1 1 0 01-.73 1.68h-3.3v5.7a1 1 0 01-1 1H8.2a1 1 0 01-1-1V11H3.9a1 1 0 01-.73-1.68l6.1-6.6A1 1 0 0110 2.4z" />
  </RedditIcon>
);

export const RedditMoreIcon = (props: RedditIconProps) => (
  <RedditIcon {...props}>
    <path d="M4.5 11.4a1.4 1.4 0 110-2.8 1.4 1.4 0 010 2.8zm5.5 0a1.4 1.4 0 110-2.8 1.4 1.4 0 010 2.8zm5.5 0a1.4 1.4 0 110-2.8 1.4 1.4 0 010 2.8z" />
  </RedditIcon>
);

export const RedditSettingsIcon = (props: RedditIconProps) => (
  <RedditIcon {...props}>
    <path d="M10 6.6a3.4 3.4 0 110 6.8 3.4 3.4 0 010-6.8zm7.8 3.4c0 .54-.06 1.06-.17 1.57l-2.02.38a6.1 6.1 0 01-.62 1.08l.68 1.94a8.05 8.05 0 01-2.72 1.57l-1.34-1.56a6.2 6.2 0 01-1.24.08l-1.35 1.56a8.05 8.05 0 01-2.72-1.57l.68-1.94a6.1 6.1 0 01-.62-1.08l-2.02-.38A7.9 7.9 0 012.2 10c0-.54.06-1.06.17-1.57l2.02-.38c.16-.38.37-.74.62-1.08l-.68-1.94a8.05 8.05 0 012.72-1.57l1.34 1.56a6.2 6.2 0 011.24-.08l1.35-1.56a8.05 8.05 0 012.72 1.57l-.68 1.94c.25.34.46.7.62 1.08l2.02.38c.11.51.17 1.03.17 1.57z" />
  </RedditIcon>
);
