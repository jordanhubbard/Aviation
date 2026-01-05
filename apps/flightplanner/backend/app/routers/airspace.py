from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query

from app.utils.data_loader import load_airspace


router = APIRouter()


@router.get("/airspace")
def airspace_status() -> dict:
    """Airspace support status."""
    data = load_airspace()
    features = data.get("features") if isinstance(data, dict) else None
    return {
        "enabled": True,
        "feature_count": len(features) if isinstance(features, list) else 0,
    }


@lru_cache(maxsize=1)
def _airspace_gdfs():
    import geopandas as gpd
    from shapely.geometry import shape

    raw = load_airspace()
    features = raw.get("features") if isinstance(raw, dict) else None
    if not isinstance(features, list) or not features:
        empty = gpd.GeoDataFrame({"properties": []}, geometry=[], crs="EPSG:4326")
        return empty, empty

    rows: list[dict] = []
    geoms = []
    for feat in features:
        if not isinstance(feat, dict):
            continue
        geom = feat.get("geometry")
        if not geom:
            continue
        try:
            geoms.append(shape(geom))
        except Exception:
            continue
        props = feat.get("properties") if isinstance(feat.get("properties"), dict) else {}
        rows.append({"properties": props})

    gdf4326 = gpd.GeoDataFrame(rows, geometry=geoms, crs="EPSG:4326")
    if gdf4326.empty:
        return gdf4326, gdf4326

    # EPSG:3857 enables buffering in meters.
    gdf3857 = gdf4326.to_crs(epsg=3857)
    return gdf4326, gdf3857


@router.get(
    "/airspace/nearby",
    summary="Nearby airspace",
    description="Return airspace GeoJSON features within a radius (NM) of a point.",
)
def airspace_nearby(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    radius_nm: float = Query(20.0, ge=0.1, le=200.0),
    limit: int = Query(250, ge=1, le=2000),
) -> dict:
    try:
        import geopandas as gpd
        from shapely.geometry import Point, mapping
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Airspace dependencies unavailable: {e}")

    gdf4326, gdf3857 = _airspace_gdfs()
    if gdf3857.empty:
        return {"type": "FeatureCollection", "features": []}

    radius_m = float(radius_nm) * 1852.0
    pt3857 = gpd.GeoSeries([Point(float(lon), float(lat))], crs="EPSG:4326").to_crs(epsg=3857)
    buf = pt3857.iloc[0].buffer(radius_m)

    hits = gdf3857[gdf3857.intersects(buf)]
    if hits.empty:
        return {"type": "FeatureCollection", "features": []}

    # Preserve stable ordering but cap payload size.
    hits = hits.head(int(limit))
    sel = gdf4326.loc[hits.index]

    out_features: list[dict] = []
    for geom, props in zip(sel.geometry, sel["properties"], strict=False):
        if geom is None:
            continue
        out_features.append(
            {
                "type": "Feature",
                "geometry": mapping(geom),
                "properties": props if isinstance(props, dict) else {},
            }
        )

    return {"type": "FeatureCollection", "features": out_features}
