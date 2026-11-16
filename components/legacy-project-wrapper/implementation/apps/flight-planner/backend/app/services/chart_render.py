"""Windowed CRS-aware raster chart rendering; no unrotated bounds approximation."""

from io import BytesIO
import math

from .charts import ChartError


def raster_info(path):
    import rasterio
    from rasterio.warp import transform_bounds

    with rasterio.Env(GDAL_CACHEMAX=64 * 1024 * 1024):
        with rasterio.open(path) as dataset:
            if dataset.crs is None:
                raise ChartError("Chart has no declared coordinate reference system")
            bounds = transform_bounds(dataset.crs, "EPSG:4326", *dataset.bounds, densify_pts=41)
            if not all(math.isfinite(v) for v in bounds):
                raise ChartError("Chart has invalid geographic bounds")
            return {
                "crs": dataset.crs.to_string(),
                "width": dataset.width,
                "height": dataset.height,
                "bounds_wgs84": list(bounds),
                "transform": list(dataset.transform)[:6],
                "limitation": "Only the main body inside the FAA chart neatline is accurately georeferenced; original margins remain in the downloaded file.",
            }


def tile(path, zoom, x, y):
    import rasterio
    from rasterio.enums import Resampling
    from rasterio.vrt import WarpedVRT
    from rasterio.transform import from_bounds
    from PIL import Image
    import numpy as np

    if not 0 <= zoom <= 16 or not 0 <= x < 2**zoom or not 0 <= y < 2**zoom:
        raise ChartError("Invalid chart tile coordinates")
    edge = 20037508.342789244
    span = 2 * edge / 2**zoom
    left, right = -edge + x * span, -edge + (x + 1) * span
    top, bottom = edge - y * span, edge - (y + 1) * span
    with rasterio.Env(GDAL_CACHEMAX=64 * 1024 * 1024):
        with rasterio.open(path) as dataset:
            if dataset.crs is None:
                raise ChartError("Chart has no georeferencing")
            # VRT handles rotated/sheared transforms and projection changes.
            palette_source = dataset.count == 1 and dataset.colorinterp[0].name == "palette"
            with WarpedVRT(
                dataset,
                crs="EPSG:3857",
                add_alpha=not any(i.name == "alpha" for i in dataset.colorinterp),
                warp_mem_limit=64,
                transform=from_bounds(left, bottom, right, top, 256, 256),
                width=256,
                height=256,
                resampling=Resampling.nearest if palette_source else Resampling.bilinear,
            ) as projected:
                data = projected.read(masked=True)
                alpha = np.where(np.any(np.ma.getmaskarray(data), axis=0), 0, 255).astype("uint8")
                raw = data.filled(0).astype("uint8")
                if projected.colorinterp[-1].name == "alpha":
                    alpha = np.minimum(alpha, raw[-1])
                if palette_source:
                    colors = dataset.colormap(1)
                    palette = np.zeros((256, 4), dtype="uint8")
                    for index, color in colors.items():
                        if index < len(palette):
                            palette[index] = color
                    rgba = palette[raw[0]]
                    rgba[:, :, 3] = np.minimum(rgba[:, :, 3], alpha)
                else:
                    rgb = (
                        np.moveaxis(raw[:3], 0, 2)
                        if raw.shape[0] >= 3
                        else np.repeat(raw[0, :, :, None], 3, axis=2)
                    )
                    if raw.shape[0] >= 4:
                        alpha = np.minimum(alpha, raw[-1])
                    rgba = np.dstack([rgb, alpha])
                output = BytesIO()
                Image.fromarray(rgba).save(output, format="PNG")
                return output.getvalue()


def pdf_page(path, number):
    import pypdfium2 as pdfium

    with pdfium.PdfDocument(str(path)) as document:
        if not 1 <= number <= len(document):
            raise ChartError("Chart PDF page not found")
        page = document[number - 1]
        width, height = page.get_size()
        if width <= 0 or height <= 0:
            raise ChartError("Invalid PDF chart page size")
        scale = min(2, math.sqrt(8_000_000 / (width * height)))
        bitmap = page.render(scale=scale)
        try:
            output = BytesIO()
            bitmap.to_pil().save(output, format="PNG")
            return output.getvalue(), len(document)
        finally:
            bitmap.close()
            page.close()
