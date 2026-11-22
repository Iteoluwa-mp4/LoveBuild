import { lazy } from "react";

/**
 * The template pages, split out of the bundle every visitor downloads.
 *
 * A published gift renders exactly one template, and most templates need none
 * of the others' code. Importing them statically here is what made every phone
 * pay for all four; these dynamic imports let the route load only the page it
 * is about to render. The editor uses the same wrappers, so it also pulls in
 * only the template currently being previewed.
 */
export const ModernTemplate = lazy(() => import("./modern/HomePage"));
export const ModernGallery = lazy(() => import("./modern/GalleryPage"));

export const ScrapbookHomePage = lazy(() => import("./scrapbook/HomePage"));
export const ScrapbookGalleryPage = lazy(() => import("./scrapbook/GalleryPage"));

export const EditorialHomePage = lazy(() => import("./editorial/HomePage"));
export const EditorialGalleryPage = lazy(() => import("./editorial/GalleryPage"));

export const GodPoetryHomePage = lazy(() => import("./godpoetry/HomePage"));
export const GodPoetryGalleryPage = lazy(() => import("./godpoetry/GalleryPage"));
