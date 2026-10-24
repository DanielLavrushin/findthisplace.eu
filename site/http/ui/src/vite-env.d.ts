/// <reference types="vite/client" />

declare module "react-simple-maps" {
  import { ComponentType, ReactNode } from "react";

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: Record<string, unknown>;
    width?: number;
    height?: number;
    style?: React.CSSProperties;
    "aria-hidden"?: boolean;
    children?: ReactNode;
  }
  interface ZoomPosition {
    coordinates: [number, number];
    zoom: number;
  }
  interface ZoomableGroupProps {
    center?: [number, number];
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
    translateExtent?: [[number, number], [number, number]];
    /** which d3-zoom gestures move the map; the rest pass to the page */
    filterZoomEvent?: (event: WheelEvent | MouseEvent | TouchEvent) => boolean;
    onMoveEnd?: (position: ZoomPosition) => void;
    children?: ReactNode;
  }
  interface GeographiesProps {
    geography: string | Record<string, unknown>;
    children: (data: {
      geographies: Geography[];
      /** the borders countries share, as one path: no coastlines */
      borders?: { svgPath: string };
      /** the coastlines alone */
      outline?: { svgPath: string };
    }) => ReactNode;
  }
  interface Geography {
    rsmKey: string;
    id: string;
    properties: Record<string, string>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
  interface GeographyProps {
    geography: Geography;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    onClick?: (event: React.MouseEvent<SVGPathElement>) => void;
    style?: {
      default?: React.CSSProperties;
      hover?: React.CSSProperties;
      pressed?: React.CSSProperties;
    };
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const ZoomableGroup: ComponentType<ZoomableGroupProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
}
