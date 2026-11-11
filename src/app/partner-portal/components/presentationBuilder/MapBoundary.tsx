"use client";
/** A map that cannot start (no WebGL, blocked tiles) hides itself instead of taking the builder down with it. */
import { Component, type ReactNode } from "react";

export class MapBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* nothing to report: the selection works without the map */ }
  render() { return this.state.failed ? this.props.fallback ?? null : this.props.children; }
}
