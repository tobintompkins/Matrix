import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // MATRIX_DIST_DIR lets validation builds avoid a locked .next from `next dev`.
  ...(process.env.MATRIX_DIST_DIR
    ? { distDir: process.env.MATRIX_DIST_DIR }
    : {}),
};

export default nextConfig;
