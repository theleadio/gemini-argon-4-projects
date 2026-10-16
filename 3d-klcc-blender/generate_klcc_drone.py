#!/usr/bin/env python3
"""
generate_klcc_drone.py
======================
Procedurally builds and renders a complete 10-second (240 frames @ 24 FPS)
3D drone flyover of KLCC (Kuala Lumpur City Centre) in Blender 5.2 LTS.

Features:
1. Authentic Petronas Twin Towers (Tower 1 & Tower 2):
   - 8-pointed Rub el Hizb star + 8 semi-circular lobes cross-section (bmesh profile).
   - 5 setback tiers, 88 illuminated office floors, brushed stainless-steel sunshade rings,
     16 perimeter mega-columns, faceted crown lanterns, and pinnacle spires with aviation beacons.
   - Double-Deck Skybridge (Floors 41-42) with V-arch diagonal support struts from Floor 29.
2. KLCC Precinct & Surrounding Skyline:
   - Suria KLCC 6-story crescent shopping mall podium & illuminated glass Esplanade canopy.
   - Menara Maxis, Menara ExxonMobil, Petronas Tower 3 (Menara Carigali), Mandarin Oriental,
     Four Seasons Place, plus background Menara KL (KL Tower) and Merdeka 118 silhouettes.
   - KLCC Park & Lake Symphony: reflective water basin, curved elevated pedestrian bridge,
     95+ tropical royal palm trees, and 36 animated musical fountain water jets (cyan/gold/magenta).
3. Real Multi-Lane Traffic System (62 Animated Vehicles):
   - Jalan Ampang (6-lane divided boulevard with median palms, crosswalks, lane markings, and
     traffic light gantries), Persiaran KLCC / Jalan P. Ramlee avenue, & Suria KLCC drop-off loop.
   - Sculpted 3D Sedans, SUVs, KL Red/White Taxis (with glowing TAXI roof sign), and
     RapidKL / GoKL City Buses with tapered cabins, grilles, license plates, rotating wheels,
     glowing headlights + moving road light pools, and ruby-red LED taillights.
4. Real Walking Pedestrians (108 Articulated 3D People):
   - Articulated 3D characters (Head, Hair/Cap/Hijab, Torso, Backpack/Bag, swinging Left/Right Arms,
     striding Left/Right Legs) with phase-offset walk-cycle animations across crosswalks,
     sidewalks, Suria KLCC Esplanade, and the Lake Symphony pedestrian bridge.
5. 10-Second Cinema Drone Camera & Lead Quadcopter Drone:
   - 240 frames @ 24 FPS (10.0s) at 1920x1080 Full HD.
   - Low-altitude street pass over traffic & pedestrians -> banking climb over Lake Symphony
     fountains & bridge -> high-altitude heroic orbit of the full Twin Towers & KL skyline.
"""

import argparse
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Euler, Vector

# Deterministic seed for reproducible architecture, traffic, and crowd placement
random.seed(42)

FPS = 24
FRAME_START = 1
FRAME_END = 240  # 10.0 seconds at 24 FPS


# ==============================================================================
# UTILITY & MATERIAL HELPERS
# ==============================================================================

def clear_scene():
    """Reset the Blender scene cleanly."""
    bpy.ops.wm.read_factory_settings(use_empty=True)


def get_or_create_collection(name, parent=None):
    if name in bpy.data.collections:
        return bpy.data.collections[name]
    col = bpy.data.collections.new(name)
    if parent is None:
        bpy.context.scene.collection.children.link(col)
    else:
        parent.children.link(col)
    return col


def set_smooth(obj):
    if obj.type == 'MESH' and obj.data:
        for poly in obj.data.polygons:
            poly.use_smooth = True


def make_material(
    name,
    base_color=(0.8, 0.8, 0.8, 1.0),
    metallic=0.0,
    roughness=0.4,
    emission_color=None,
    emission_strength=0.0,
    transmission=0.0,
    coat_weight=0.0,
    alpha=1.0,
):
    """Create a Principled BSDF material compatible with Blender 5.2."""
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name=name)
    nodes = mat.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf is None:
        bsdf = nodes.new(type="ShaderNodeBsdfPrincipled")

    if len(base_color) == 3:
        base_color = (*base_color, 1.0)
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness

    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = transmission
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = coat_weight
    if alpha < 1.0:
        bsdf.inputs["Alpha"].default_value = alpha
        if hasattr(mat, "surface_render_method"):
            mat.surface_render_method = 'BLENDED'

    if emission_color is not None and emission_strength > 0.0:
        if len(emission_color) == 3:
            emission_color = (*emission_color, 1.0)
        bsdf.inputs["Emission Color"].default_value = emission_color
        bsdf.inputs["Emission Strength"].default_value = emission_strength

    return mat


def make_tower_facade_material(name="Mat_Petronas_Facade"):
    """
    Create a procedural high-rise curtain wall material with horizontal floor spandrels,
    vertical mullions, and warm/cool illuminated office windows for the Petronas Towers.
    Maps (X + Y, Z, 0) into a 2D Brick Texture so vertical walls have crisp 3D window grids!
    """
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name=name)
    tree = mat.node_tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.06, 0.22, 0.28, 1.0)  # Teal-blue reflective glass
    bsdf.inputs["Metallic"].default_value = 0.72
    bsdf.inputs["Roughness"].default_value = 0.14
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = 0.85
        bsdf.inputs["Coat Roughness"].default_value = 0.05

    tex_coord = nodes.new("ShaderNodeTexCoord")
    sep_xyz = nodes.new("ShaderNodeSeparateXYZ")
    links.new(tex_coord.outputs["Object"], sep_xyz.inputs["Vector"])

    # Combine X + Y for horizontal perimeter coordinate U, and Z for vertical floor coordinate V
    add_xy = nodes.new("ShaderNodeMath")
    add_xy.operation = 'ADD'
    links.new(sep_xyz.outputs["X"], add_xy.inputs[0])
    links.new(sep_xyz.outputs["Y"], add_xy.inputs[1])

    comb_uv = nodes.new("ShaderNodeCombineXYZ")
    links.new(add_xy.outputs["Value"], comb_uv.inputs["X"])
    links.new(sep_xyz.outputs["Z"], comb_uv.inputs["Y"])

    # Brick texture in (X+Y, Z) space -> authentic vertical mullions & horizontal floor bands
    brick = nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.0
    brick.inputs["Scale"].default_value = 0.54
    brick.inputs["Mortar Size"].default_value = 0.11
    brick.inputs["Mortar Smooth"].default_value = 0.02
    brick.inputs["Brick Width"].default_value = 0.85
    brick.inputs["Row Height"].default_value = 1.00
    brick.inputs["Color1"].default_value = (1.0, 0.90, 0.70, 1.0)  # Warm tungsten/gold office glow
    brick.inputs["Color2"].default_value = (0.48, 0.86, 1.0, 1.0)  # Cool daylight LED office glow
    brick.inputs["Mortar"].default_value = (0.02, 0.06, 0.10, 1.0)
    links.new(comb_uv.outputs["Vector"], brick.inputs["Vector"])

    # Invert Brick Fac (0 = mortar mullion, 1 = glowing window pane)
    math_inv = nodes.new("ShaderNodeMath")
    math_inv.operation = 'SUBTRACT'
    math_inv.inputs[0].default_value = 1.0
    links.new(brick.outputs["Fac"], math_inv.inputs[1])

    math_mul = nodes.new("ShaderNodeMath")
    math_mul.operation = 'MULTIPLY'
    math_mul.inputs[1].default_value = 2.6  # Rich window glow without white-out
    links.new(math_inv.outputs["Value"], math_mul.inputs[0])

    links.new(brick.outputs["Color"], bsdf.inputs["Emission Color"])
    links.new(math_mul.outputs["Value"], bsdf.inputs["Emission Strength"])
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    return mat


def make_skyline_window_material(name, glass_color, glow_color1, glow_color2, scale=0.65, strength=2.4):
    """
    Procedural glowing office/hotel/mall window grid material for surrounding KL skyscrapers.
    Maps Object (X + Y, Z, 0) into aligned architectural window rows with per-room variation!
    """
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name=name)
    tree = mat.node_tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (*glass_color, 1.0)
    bsdf.inputs["Metallic"].default_value = 0.72
    bsdf.inputs["Roughness"].default_value = 0.14
    if "Coat Weight" in bsdf.inputs:
        bsdf.inputs["Coat Weight"].default_value = 0.7

    tex_coord = nodes.new("ShaderNodeTexCoord")
    sep_xyz = nodes.new("ShaderNodeSeparateXYZ")
    links.new(tex_coord.outputs["Object"], sep_xyz.inputs["Vector"])

    add_xy = nodes.new("ShaderNodeMath")
    add_xy.operation = 'ADD'
    links.new(sep_xyz.outputs["X"], add_xy.inputs[0])
    links.new(sep_xyz.outputs["Y"], add_xy.inputs[1])

    comb_uv = nodes.new("ShaderNodeCombineXYZ")
    links.new(add_xy.outputs["Value"], comb_uv.inputs["X"])
    links.new(sep_xyz.outputs["Z"], comb_uv.inputs["Y"])

    brick = nodes.new("ShaderNodeTexBrick")
    brick.offset = 0.5
    brick.offset_frequency = 2
    brick.inputs["Scale"].default_value = scale
    brick.inputs["Mortar Size"].default_value = 0.18
    brick.inputs["Mortar Smooth"].default_value = 0.01
    brick.inputs["Brick Width"].default_value = 1.15
    brick.inputs["Row Height"].default_value = 0.85
    brick.inputs["Bias"].default_value = -0.15  # Mix of bright and dim/off rectangular office windows
    brick.inputs["Color1"].default_value = (*glow_color1, 1.0)
    brick.inputs["Color2"].default_value = (glow_color2[0] * 0.22, glow_color2[1] * 0.25, glow_color2[2] * 0.30, 1.0)
    brick.inputs["Mortar"].default_value = (0.01, 0.015, 0.025, 1.0)
    links.new(comb_uv.outputs["Vector"], brick.inputs["Vector"])

    math_inv = nodes.new("ShaderNodeMath")
    math_inv.operation = 'SUBTRACT'
    math_inv.inputs[0].default_value = 1.0
    links.new(brick.outputs["Fac"], math_inv.inputs[1])

    math_str = nodes.new("ShaderNodeMath")
    math_str.operation = 'MULTIPLY'
    math_str.inputs[1].default_value = strength
    links.new(math_inv.outputs["Value"], math_str.inputs[0])

    links.new(brick.outputs["Color"], bsdf.inputs["Emission Color"])
    links.new(math_str.outputs["Value"], bsdf.inputs["Emission Strength"])
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    return mat


def create_box(name, size, location, material=None, collection=None, rotation=(0, 0, 0)):
    """Create a box mesh using bmesh."""
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler = rotation
    if material:
        obj.data.materials.append(material)
    if collection:
        collection.objects.link(obj)
    else:
        bpy.context.scene.collection.objects.link(obj)
    return obj


def create_tapered_box(name, size_bottom, size_top, height, location, offset_top_x=0.0, material=None, collection=None, rotation=(0, 0, 0)):
    """Create a sculpted frustum/tapered box (ideal for sloped car cabins, hoods, and architectural roofs)."""
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm = bmesh.new()

    bx, by = size_bottom[0] * 0.5, size_bottom[1] * 0.5
    tx, ty = size_top[0] * 0.5, size_top[1] * 0.5
    zh = height * 0.5

    vb = [
        bm.verts.new((-bx, -by, -zh)),
        bm.verts.new((bx, -by, -zh)),
        bm.verts.new((bx, by, -zh)),
        bm.verts.new((-bx, by, -zh)),
    ]
    vt = [
        bm.verts.new((offset_top_x - tx, -ty, zh)),
        bm.verts.new((offset_top_x + tx, -ty, zh)),
        bm.verts.new((offset_top_x + tx, ty, zh)),
        bm.verts.new((offset_top_x - tx, ty, zh)),
    ]

    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((vb[i], vb[j], vt[j], vt[i]))
    bm.faces.new(list(reversed(vb)))
    bm.faces.new(vt)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler = rotation
    if material:
        obj.data.materials.append(material)
    if collection:
        collection.objects.link(obj)
    else:
        bpy.context.scene.collection.objects.link(obj)
    return obj


def create_cylinder(
    name,
    radius1,
    radius2,
    depth,
    location,
    segments=24,
    material=None,
    collection=None,
    rotation=(0, 0, 0),
    smooth=True,
):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segments,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
    )
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.rotation_euler = rotation
    if material:
        obj.data.materials.append(material)
    if smooth:
        set_smooth(obj)
    if collection:
        collection.objects.link(obj)
    else:
        bpy.context.scene.collection.objects.link(obj)
    return obj


def create_sphere(name, radius, location, segments=16, ring_count=12, material=None, collection=None):
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=ring_count, radius=radius)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    if material:
        obj.data.materials.append(material)
    set_smooth(obj)
    if collection:
        collection.objects.link(obj)
    else:
        bpy.context.scene.collection.objects.link(obj)
    return obj


# ==============================================================================
# 1. PETRONAS TWIN TOWERS & DOUBLE-DECK SKYBRIDGE
# ==============================================================================

def rub_el_hizb_profile_points(outer_radius, num_samples=160):
    """
    Compute the exact 2D cross-section of the Petronas Twin Towers:
    An 8-pointed Rub el Hizb star (two overlapping squares rotated by 45 deg)
    combined with 8 protruding semi-circular lobes nestled in the inner valleys.
    """
    a = outer_radius / math.sqrt(2.0)
    d_lobe = 0.67 * outer_radius
    r_lobe = 0.235 * outer_radius

    pts = []
    for i in range(num_samples):
        theta = 2.0 * math.pi * i / num_samples
        ct = math.cos(theta)
        st = math.sin(theta)

        r_sq1 = a / max(abs(ct), abs(st), 1e-6)
        theta45 = theta - math.pi / 4.0
        r_sq2 = a / max(abs(math.cos(theta45)), abs(math.sin(theta45)), 1e-6)
        r_star = max(r_sq1, r_sq2)

        r_max = r_star
        for k in range(8):
            phi = (k + 0.5) * math.pi / 4.0
            b_proj = d_lobe * math.cos(theta - phi)
            if b_proj > 0:
                disc = b_proj * b_proj - (d_lobe * d_lobe - r_lobe * r_lobe)
                if disc >= 0:
                    r_circle = b_proj + math.sqrt(disc)
                    if r_circle > r_max:
                        r_max = r_circle

        pts.append((r_max * ct, r_max * st))
    return pts


def create_extruded_profile(name, pts_2d, z_bottom, z_top, scale_top=1.0, material=None, collection=None, location=(0, 0, 0)):
    """Create a closed 3D prism/frustum from a 2D polygon profile."""
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm = bmesh.new()

    bottom_verts = [bm.verts.new((x, y, z_bottom)) for (x, y) in pts_2d]
    top_verts = [bm.verts.new((x * scale_top, y * scale_top, z_top)) for (x, y) in pts_2d]
    n = len(pts_2d)

    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bottom_verts[i], bottom_verts[j], top_verts[j], top_verts[i]))

    bm.faces.new(list(reversed(bottom_verts)))
    bm.faces.new(top_verts)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    if material:
        obj.data.materials.append(material)
    if collection:
        collection.objects.link(obj)
    return obj


def create_sunshade_rings_mesh(name, tiers, location, material, collection):
    """
    Build all 88 horizontal stainless-steel sunshade rings for a Petronas Tower
    in a single combined mesh for fast EEVEE rendering and authentic detail.
    """
    mesh = bpy.data.meshes.new(name + "_Mesh")
    bm = bmesh.new()

    ring_thickness = 0.34
    ring_outset = 1.032

    for z_start, z_end, r_tier, floor_step in tiers:
        pts_inner = rub_el_hizb_profile_points(r_tier * 0.995, num_samples=96)
        pts_outer = rub_el_hizb_profile_points(r_tier * ring_outset, num_samples=96)
        n = len(pts_inner)

        z = z_start + floor_step
        while z <= z_end + 0.1:
            zb = z - ring_thickness * 0.5
            zt = z + ring_thickness * 0.5
            v_bi = [bm.verts.new((x, y, zb)) for (x, y) in pts_inner]
            v_bo = [bm.verts.new((x, y, zb)) for (x, y) in pts_outer]
            v_to = [bm.verts.new((x, y, zt)) for (x, y) in pts_outer]
            v_ti = [bm.verts.new((x, y, zt)) for (x, y) in pts_inner]

            for i in range(n):
                j = (i + 1) % n
                bm.faces.new((v_bo[i], v_bo[j], v_to[j], v_to[i]))
                bm.faces.new((v_to[i], v_to[j], v_ti[j], v_ti[i]))
                bm.faces.new((v_bi[i], v_bi[j], v_bo[j], v_bo[i]))
            z += floor_step

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    if material:
        obj.data.materials.append(material)
    if collection:
        collection.objects.link(obj)
    return obj


def build_single_petronas_tower(tower_name, center_xy, col, mats):
    """Build one complete Petronas Tower (lobby, 5 setback tiers, 88 sunshade rings, columns, crown & spire)."""
    cx, cy = center_xy

    tiers = [
        # (z_bottom, z_top, outer_radius, floor_height)
        (0.0, 74.0, 18.5, 1.85),     # Floors 1 - 40
        (74.0, 107.3, 16.0, 1.85),   # Floors 41 - 58 (Skybridge attaches at 76-80m)
        (107.3, 133.2, 13.4, 1.85),  # Floors 59 - 72
        (133.2, 151.7, 10.7, 1.85),  # Floors 73 - 82
        (151.7, 162.8, 7.9, 1.85),   # Floors 83 - 88
    ]

    # Base lobby glowing ring & canopy
    pts_lobby = rub_el_hizb_profile_points(19.6, num_samples=128)
    create_extruded_profile(
        f"{tower_name}_Lobby_Base",
        pts_lobby,
        0.0,
        5.5,
        scale_top=0.96,
        material=mats["warm_glass"],
        collection=col,
        location=(cx, cy, 0.0),
    )

    for idx, (zb, zt, rad, _) in enumerate(tiers):
        pts = rub_el_hizb_profile_points(rad, num_samples=128)
        create_extruded_profile(
            f"{tower_name}_Tier_{idx+1}",
            pts,
            zb,
            zt,
            scale_top=1.0,
            material=mats["tower_facade"],
            collection=col,
            location=(cx, cy, 0.0),
        )
        if idx < len(tiers) - 1:
            next_rad = tiers[idx + 1][2]
            scale_ratio = (next_rad * 1.03) / (rad * 1.03)
            pts_cap = rub_el_hizb_profile_points(rad * 1.03, num_samples=96)
            create_extruded_profile(
                f"{tower_name}_SetbackCap_{idx+1}",
                pts_cap,
                zt,
                zt + 1.6,
                scale_top=scale_ratio,
                material=mats["stainless_steel"],
                collection=col,
                location=(cx, cy, 0.0),
            )
            create_cylinder(
                f"{tower_name}_SetbackGlow_{idx+1}",
                rad * 0.96,
                next_rad * 1.01,
                0.45,
                (cx, cy, zt + 0.25),
                segments=16,
                material=mats["tower_crown_glow"],
                collection=col,
            )

    create_sunshade_rings_mesh(
        f"{tower_name}_Sunshade_Rings",
        tiers,
        (cx, cy, 0.0),
        mats["stainless_steel"],
        col,
    )

    for idx, (zb, zt, rad, _) in enumerate(tiers):
        h = zt - zb
        z_mid = 0.5 * (zb + zt)
        for k in range(8):
            ang_star = k * math.pi / 4.0
            r_s = rad * 0.99
            create_cylinder(
                f"{tower_name}_T{idx+1}_ColStar_{k}",
                0.52,
                0.52,
                h,
                (cx + r_s * math.cos(ang_star), cy + r_s * math.sin(ang_star), z_mid),
                segments=10,
                material=mats["stainless_steel"],
                collection=col,
            )
            ang_lobe = (k + 0.5) * math.pi / 4.0
            r_l = rad * 0.905
            create_cylinder(
                f"{tower_name}_T{idx+1}_ColLobe_{k}",
                0.48,
                0.48,
                h,
                (cx + r_l * math.cos(ang_lobe), cy + r_l * math.sin(ang_lobe), z_mid),
                segments=10,
                material=mats["stainless_steel"],
                collection=col,
            )

    # Faceted Crown Lantern & Pinnacle Spire (Z = 162.8m to 198.0m)
    pts_crown = rub_el_hizb_profile_points(7.8, num_samples=96)
    create_extruded_profile(
        f"{tower_name}_Crown_Lantern",
        pts_crown,
        162.8,
        172.5,
        scale_top=0.45,
        material=mats["tower_crown_glow"],
        collection=col,
        location=(cx, cy, 0.0),
    )

    for k in range(8):
        ang = k * math.pi / 4.0
        r_mid = 5.4
        tilt = 0.28
        rib = create_cylinder(
            f"{tower_name}_Crown_Rib_{k}",
            0.32,
            0.18,
            12.0,
            (cx + r_mid * math.cos(ang), cy + r_mid * math.sin(ang), 168.5),
            segments=8,
            material=mats["stainless_steel"],
            collection=col,
        )
        rib.rotation_euler = Euler((-tilt * math.sin(ang), tilt * math.cos(ang), 0.0), 'XYZ')

    create_cylinder(
        f"{tower_name}_Spire_BaseCone",
        3.4,
        1.25,
        6.5,
        (cx, cy, 175.5),
        segments=24,
        material=mats["stainless_steel"],
        collection=col,
    )
    create_cylinder(
        f"{tower_name}_Spire_Mast",
        1.15,
        0.18,
        20.5,
        (cx, cy, 188.0),
        segments=20,
        material=mats["stainless_steel"],
        collection=col,
    )
    for f_idx, (z_ring, r_ring) in enumerate([(179.5, 1.85), (183.5, 1.45), (187.5, 1.10), (191.5, 0.78)]):
        create_sphere(
            f"{tower_name}_Spire_Orb_{f_idx}",
            r_ring,
            (cx, cy, z_ring),
            segments=16,
            ring_count=12,
            material=mats["tower_crown_glow"] if f_idx == 0 else mats["stainless_steel"],
            collection=col,
        )

    create_sphere(
        f"{tower_name}_Aviation_Beacon",
        0.72,
        (cx, cy, 198.5),
        segments=12,
        ring_count=10,
        material=mats["beacon_red"],
        collection=col,
    )


def build_skybridge(col, mats):
    """
    Build the iconic Double-Deck Skybridge at Floors 41-42 (Z = 76.0m & 79.2m)
    spanning between Tower 1 (X=-28) and Tower 2 (X=+28), plus the 4 diagonal
    V-arch support legs springing from Floor 29 (Z = 53.5m).
    """
    span_x = 32.0

    for deck_name, z_deck in [("LowerDeck_F41", 76.2), ("UpperDeck_F42", 79.0)]:
        create_box(
            f"Skybridge_{deck_name}_Slab",
            (span_x, 5.4, 0.55),
            (0.0, 0.0, z_deck - 0.95),
            material=mats["stainless_steel"],
            collection=col,
        )
        create_box(
            f"Skybridge_{deck_name}_Glass",
            (span_x - 1.0, 4.6, 1.95),
            (0.0, 0.0, z_deck + 0.15),
            material=mats["skybridge_glow"],
            collection=col,
        )

    create_box(
        "Skybridge_Roof_Cap",
        (span_x, 5.6, 0.65),
        (0.0, 0.0, 80.35),
        material=mats["stainless_steel"],
        collection=col,
    )

    for x_mull in range(-14, 15, 2):
        for y_side in (-2.6, 2.6):
            create_box(
                f"Skybridge_Mullion_{x_mull}_{int(y_side)}",
                (0.28, 0.30, 5.4),
                (float(x_mull), y_side, 77.7),
                material=mats["stainless_steel"],
                collection=col,
            )

    create_box(
        "Skybridge_Center_Collar",
        (4.2, 6.2, 1.6),
        (0.0, 0.0, 74.6),
        material=mats["stainless_steel"],
        collection=col,
    )

    for side_x in (-1.0, 1.0):
        for side_y in (-1.0, 1.0):
            p_start = Vector((side_x * 16.2, side_y * 2.3, 53.5))
            p_end = Vector((side_x * 1.1, side_y * 1.8, 74.6))
            diff = p_end - p_start
            length = diff.length
            mid = 0.5 * (p_start + p_end)
            rot = diff.to_track_quat('Z', 'Y').to_euler()

            create_cylinder(
                f"Skybridge_ArchStrut_{int(side_x)}_{int(side_y)}",
                0.58,
                0.48,
                length,
                mid,
                segments=16,
                material=mats["stainless_steel"],
                collection=col,
                rotation=rot,
            )


# ==============================================================================
# 2. SURIA KLCC, PRECINCT SKYLINE, KLCC PARK & LAKE SYMPHONY FOUNTAINS
# ==============================================================================

def build_suria_klcc_and_skyline(col, mats):
    """
    Build Suria KLCC crescent mall podium, Esplanade glass canopy,
    Menara Maxis, Petronas Tower 3, Menara ExxonMobil, Four Seasons Place,
    Mandarin Oriental, Menara KL (KL Tower), Merdeka 118, and surrounding high-rises.
    """
    # --- Suria KLCC 6-Story Crescent Shopping Mall Podium (Y = -8m to -35m) ---
    for tier_i in range(3):
        z_h = 5.8
        z_c = tier_i * z_h + z_h * 0.5
        rad_x = 58.0 - tier_i * 3.5
        rad_y = 22.0 - tier_i * 1.8
        pod = create_cylinder(
            f"Suria_KLCC_Podium_L{tier_i+1}",
            rad_x,
            rad_x * 0.97,
            z_h - 0.35,
            (0.0, -18.0, z_c),
            segments=48,
            material=mats["suria_mall_glow"],
            collection=col,
        )
        for v in pod.data.vertices:
            v.co.y *= (rad_y / rad_x)
        pod.data.update()
        cornice = create_cylinder(
            f"Suria_KLCC_Cornice_L{tier_i+1}",
            rad_x * 1.015,
            rad_x * 1.015,
            0.55,
            (0.0, -18.0, (tier_i + 1) * z_h),
            segments=48,
            material=mats["stainless_steel"],
            collection=col,
        )
        for v in cornice.data.vertices:
            v.co.y *= (rad_y / rad_x)
        cornice.data.update()

    # Suria KLCC Esplanade Sweeping Glass Canopy (Y = -34.5m, overlooking Lake Symphony)
    canopy = create_cylinder(
        "Suria_Esplanade_Canopy",
        24.0,
        26.0,
        0.95,
        (0.0, -34.5, 6.2),
        segments=36,
        material=mats["skybridge_glow"],
        collection=col,
    )
    canopy.scale.y = 0.38

    # Suria KLCC South Drop-Off Entrance Portico (Y = -65.5m)
    create_box(
        "Suria_DropOff_Portico",
        (26.0, 5.8, 0.65),
        (0.0, -65.5, 5.4),
        material=mats["warm_glass"],
        collection=col,
    )
    for px in (-11.0, -4.0, 4.0, 11.0):
        create_cylinder(
            f"Suria_Portico_Pillar_{int(px)}",
            0.35,
            0.35,
            5.4,
            (px, -68.0, 2.7),
            segments=12,
            material=mats["stainless_steel"],
            collection=col,
        )

    # --- Menara Maxis (East of Twin Towers, X = +70m, Y = -6m, Height = 134m) ---
    create_box(
        "Menara_Maxis_Main",
        (24.0, 22.0, 126.0),
        (70.0, -6.0, 63.0),
        material=mats["skyline_cool"],
        collection=col,
    )
    for z_band in range(18, 128, 18):
        create_box(
            f"Menara_Maxis_Band_{z_band}",
            (24.8, 22.8, 0.8),
            (70.0, -6.0, float(z_band)),
            material=mats["stainless_steel"],
            collection=col,
        )
    create_cylinder(
        "Menara_Maxis_Crown",
        11.5,
        8.0,
        12.0,
        (70.0, -6.0, 132.0),
        segments=24,
        material=mats["tower_crown_glow"],
        collection=col,
    )

    # --- Petronas Tower 3 / Menara Carigali (West of Suria KLCC, X = -68m, Y = -14m, Height = 118m) ---
    create_cylinder(
        "Petronas_Tower_3",
        14.5,
        13.2,
        114.0,
        (-68.0, -14.0, 57.0),
        segments=8,
        material=mats["tower_facade"],
        collection=col,
    )
    create_cylinder(
        "Petronas_Tower_3_Crown",
        12.8,
        9.5,
        9.0,
        (-68.0, -14.0, 118.5),
        segments=8,
        material=mats["tower_crown_glow"],
        collection=col,
    )

    # --- Four Seasons Place KL (North-West of Twin Towers, X = -78m, Y = +36m, Height = 154m) ---
    create_box(
        "Four_Seasons_Place",
        (21.0, 21.0, 148.0),
        (-78.0, 36.0, 74.0),
        material=mats["skyline_warm"],
        collection=col,
    )
    create_box(
        "Four_Seasons_Crown",
        (16.0, 16.0, 12.0),
        (-78.0, 36.0, 154.0),
        material=mats["tower_crown_glow"],
        collection=col,
    )

    # --- Menara ExxonMobil (South-East of KLCC Park, X = +92m, Y = -46m, Height = 96m) ---
    create_box(
        "Menara_ExxonMobil",
        (25.0, 20.0, 96.0),
        (92.0, -46.0, 48.0),
        material=mats["skyline_gold"],
        collection=col,
    )
    create_box(
        "Menara_ExxonMobil_Crown",
        (25.6, 20.6, 2.5),
        (92.0, -46.0, 97.2),
        material=mats["warm_glass"],
        collection=col,
    )

    # --- Mandarin Oriental Hotel (West of KLCC Park, X = -84m, Y = -50m, Height = 76m) ---
    create_box(
        "Mandarin_Oriental_KL",
        (28.0, 18.0, 76.0),
        (-84.0, -50.0, 38.0),
        material=mats["skyline_warm"],
        collection=col,
        rotation=(0.0, 0.0, 0.25),
    )

    # --- Background Iconic Landmark 1: Menara KL (KL Tower) at (X = -135m, Y = +120m) ---
    kl_x, kl_y = -135.0, 120.0
    create_cylinder(
        "KL_Tower_Shaft",
        5.8,
        3.2,
        130.0,
        (kl_x, kl_y, 65.0),
        segments=20,
        material=mats["concrete_light"],
        collection=col,
    )
    create_cylinder(
        "KL_Tower_Pod_Lower",
        4.2,
        10.8,
        6.5,
        (kl_x, kl_y, 132.0),
        segments=24,
        material=mats["stainless_steel"],
        collection=col,
    )
    create_cylinder(
        "KL_Tower_Pod_Glass",
        10.8,
        11.2,
        5.5,
        (kl_x, kl_y, 138.0),
        segments=24,
        material=mats["skybridge_glow"],
        collection=col,
    )
    create_cylinder(
        "KL_Tower_Pod_Upper",
        11.0,
        4.5,
        5.0,
        (kl_x, kl_y, 143.0),
        segments=24,
        material=mats["warm_glass"],
        collection=col,
    )
    create_cylinder(
        "KL_Tower_Antenna",
        1.4,
        0.2,
        38.0,
        (kl_x, kl_y, 164.0),
        segments=12,
        material=mats["stainless_steel"],
        collection=col,
    )
    create_sphere(
        "KL_Tower_Beacon",
        0.8,
        (kl_x, kl_y, 183.5),
        material=mats["beacon_red"],
        collection=col,
    )

    # --- Background Iconic Landmark 2: Merdeka 118 at (X = +128m, Y = +135m) ---
    m_x, m_y = 128.0, 135.0
    create_cylinder(
        "Merdeka_118_Body",
        16.5,
        10.5,
        168.0,
        (m_x, m_y, 84.0),
        segments=6,
        material=mats["skyline_cool"],
        collection=col,
    )
    create_cylinder(
        "Merdeka_118_Crown",
        10.5,
        1.5,
        24.0,
        (m_x, m_y, 180.0),
        segments=6,
        material=mats["tower_crown_glow"],
        collection=col,
    )
    create_cylinder(
        "Merdeka_118_Spire",
        1.4,
        0.15,
        36.0,
        (m_x, m_y, 208.0),
        segments=8,
        material=mats["skybridge_glow"],
        collection=col,
    )

    # --- Additional KLCC / Jalan Ampang High-Rise Skyline Context (19 towers) ---
    skyline_specs = [
        (-125.0, 28.0, 24.0, 22.0, 108.0, "skyline_cool"),
        (-118.0, -18.0, 22.0, 20.0, 88.0, "skyline_gold"),
        (-132.0, -68.0, 26.0, 22.0, 74.0, "skyline_warm"),
        (-128.0, -122.0, 28.0, 22.0, 68.0, "skyline_cool"),
        (-98.0, -134.0, 26.0, 20.0, 62.0, "skyline_warm"),
        (98.0, -134.0, 28.0, 22.0, 66.0, "skyline_gold"),
        (128.0, -124.0, 26.0, 22.0, 78.0, "skyline_cool"),
        (132.0, -62.0, 24.0, 24.0, 86.0, "skyline_warm"),
        (124.0, -8.0, 26.0, 24.0, 112.0, "skyline_cool"),
        (114.0, 42.0, 24.0, 22.0, 124.0, "skyline_gold"),
        (78.0, 58.0, 26.0, 24.0, 118.0, "skyline_warm"),
        (34.0, 72.0, 24.0, 22.0, 104.0, "skyline_cool"),
        (-34.0, 74.0, 24.0, 22.0, 108.0, "skyline_gold"),
        (-95.0, 82.0, 28.0, 26.0, 116.0, "skyline_cool"),
        (0.0, 105.0, 30.0, 24.0, 96.0, "skyline_warm"),
        (-58.0, 118.0, 26.0, 24.0, 92.0, "skyline_cool"),
        (64.0, 115.0, 28.0, 24.0, 98.0, "skyline_gold"),
        (158.0, 48.0, 26.0, 26.0, 94.0, "skyline_warm"),
        (-162.0, 45.0, 26.0, 26.0, 90.0, "skyline_cool"),
    ]
    for idx, (bx, by, sx, sy, sh, mat_key) in enumerate(skyline_specs):
        create_box(
            f"KL_Skyline_Tower_{idx+1}",
            (sx, sy, sh),
            (bx, by, sh * 0.5),
            material=mats[mat_key],
            collection=col,
        )
        create_box(
            f"KL_Skyline_Crown_{idx+1}",
            (sx * 0.92, sy * 0.92, 1.2),
            (bx, by, sh + 0.6),
            material=mats["warm_glass"] if idx % 2 == 0 else mats["skybridge_glow"],
            collection=col,
        )


def build_lake_symphony_and_park(col, mats):
    """
    Build KLCC Park lawns, Lake Symphony reflective basin, curved pedestrian bridge,
    and 36 animated musical fountain jets dancing across all 240 frames.
    """
    create_box(
        "KLCC_Park_Lawn",
        (165.0, 48.0, 0.25),
        (8.0, -52.0, 0.12),
        material=mats["park_grass"],
        collection=col,
    )

    create_cylinder(
        "Esplanade_Paved_Plaza",
        46.0,
        46.0,
        0.30,
        (4.0, -47.0, 0.15),
        segments=48,
        material=mats["plaza_stone"],
        collection=col,
    )
    bpy.data.objects["Esplanade_Paved_Plaza"].scale.y = 0.52

    # Lake Symphony Dark Mirror Reflective Water Basin (X = -26m to +36m, Y = -61m to -37m)
    water_basin = create_cylinder(
        "Lake_Symphony_Water",
        33.0,
        33.0,
        0.36,
        (5.0, -48.5, 0.19),
        segments=48,
        material=mats["lake_water"],
        collection=col,
    )
    water_basin.scale.y = 0.42

    # Stone Coping Rim around Lake Symphony
    basin_rim = create_cylinder(
        "Lake_Symphony_Stone_Rim",
        33.7,
        33.7,
        0.33,
        (5.0, -48.5, 0.17),
        segments=48,
        material=mats["concrete_light"],
        collection=col,
    )
    basin_rim.scale.y = 0.428

    # --- Curved Elevated Pedestrian Bridge across Lake Symphony ---
    bridge_segs = 22
    for i in range(bridge_segs):
        t0 = i / bridge_segs
        t1 = (i + 1) / bridge_segs
        tm = 0.5 * (t0 + t1)

        x = -22.0 + 54.0 * tm
        y = -52.5 + 5.2 * math.sin(math.pi * tm)
        z = 0.45 + 2.65 * math.sin(math.pi * tm)

        dx = 54.0 / bridge_segs
        dy = 5.2 * math.pi * math.cos(math.pi * tm) / bridge_segs
        dz = 2.65 * math.pi * math.cos(math.pi * tm) / bridge_segs
        seg_len = math.sqrt(dx * dx + dy * dy)
        yaw = math.atan2(dy, dx)
        pitch = -math.atan2(dz, seg_len)

        create_box(
            f"Lake_Bridge_Deck_{i}",
            (seg_len * 1.08, 3.2, 0.28),
            (x, y, z),
            material=mats["bridge_deck"],
            collection=col,
            rotation=(0.0, pitch, yaw),
        )
        # Sleek brushed-steel handrails with warm LED strip
        for side in (-1.45, 1.45):
            rx = x - side * math.sin(yaw)
            ry = y + side * math.cos(yaw)
            create_box(
                f"Lake_Bridge_Rail_{i}_{int(side*10)}",
                (seg_len * 1.08, 0.12, 0.85),
                (rx, ry, z + 0.50),
                material=mats["stainless_steel"],
                collection=col,
                rotation=(0.0, pitch, yaw),
            )
            create_box(
                f"Lake_Bridge_LED_{i}_{int(side*10)}",
                (seg_len * 1.08, 0.16, 0.08),
                (rx, ry, z + 0.94),
                material=mats["warm_glass"],
                collection=col,
                rotation=(0.0, pitch, yaw),
            )
        if i in (4, 9, 13, 18):
            create_cylinder(
                f"Lake_Bridge_Pier_{i}",
                0.36,
                0.42,
                z,
                (x, y, z * 0.5),
                segments=12,
                material=mats["concrete_light"],
                collection=col,
            )

    # --- 36 Animated Musical Fountain Water Jets (Rich Cyan, Gold, Magenta) ---
    fountain_mats = [mats["fountain_cyan"], mats["fountain_gold"], mats["fountain_magenta"]]
    for j in range(36):
        arc_row = 0 if j < 20 else 1
        idx_in_row = j if j < 20 else (j - 20)
        count_in_row = 20 if arc_row == 0 else 16
        u = idx_in_row / max(count_in_row - 1, 1)

        angle = -0.85 + 1.70 * u
        rx = 24.0 if arc_row == 0 else 16.5
        ry = 7.5 if arc_row == 0 else 4.2
        fx = 5.0 + rx * math.sin(angle)
        fy = (-43.5 if arc_row == 0 else -54.5) + ry * math.cos(angle) * 0.35

        f_mat = fountain_mats[j % 3]
        jet = create_cylinder(
            f"Fountain_Jet_{j+1:02d}",
            0.28,
            0.07,
            1.0,
            (fx, fy, 0.9),
            segments=10,
            material=f_mat,
            collection=col,
        )
        create_cylinder(
            f"Fountain_Splash_{j+1:02d}",
            0.68,
            0.48,
            0.14,
            (fx, fy, 0.40),
            segments=12,
            material=f_mat,
            collection=col,
        )

        for f in range(FRAME_START, FRAME_END + 1, 6):
            wave = 0.55 + 0.45 * math.sin(0.11 * f + j * 0.45) * math.cos(0.05 * f - j * 0.2)
            jet_h = 3.2 + 11.5 * max(0.1, wave)
            jet.scale = (1.0, 1.0, jet_h)
            jet.location = (fx, fy, 0.35 + jet_h * 0.5)
            jet.keyframe_insert(data_path="scale", frame=f)
            jet.keyframe_insert(data_path="location", frame=f)


def create_royal_palm_tree(name, location, scale, col, mats):
    """Build a tropical Malaysian Royal Palm tree with curved trunk & radiating fronds."""
    px, py, pz = location
    trunk_h = 8.8 * scale

    create_cylinder(
        f"{name}_Trunk",
        0.34 * scale,
        0.20 * scale,
        trunk_h * 0.82,
        (px, py, pz + trunk_h * 0.41),
        segments=10,
        material=mats["palm_trunk"],
        collection=col,
    )
    create_cylinder(
        f"{name}_Crownshaft",
        0.22 * scale,
        0.26 * scale,
        trunk_h * 0.20,
        (px, py, pz + trunk_h * 0.90),
        segments=10,
        material=mats["palm_frond"],
        collection=col,
    )

    top_z = pz + trunk_h * 0.98
    num_fronds = 9
    for k in range(num_fronds):
        yaw = k * (2.0 * math.pi / num_fronds) + (px * 0.13)
        pitch = 0.35 if k % 2 == 0 else 0.62
        frond_len = 3.4 * scale
        fx = px + math.cos(yaw) * frond_len * 0.46
        fy = py + math.sin(yaw) * frond_len * 0.46
        fz = top_z + (0.25 if k % 2 == 0 else -0.15) * scale
        create_box(
            f"{name}_Frond_{k}",
            (frond_len, 0.68 * scale, 0.08 * scale),
            (fx, fy, fz),
            material=mats["palm_frond"],
            collection=col,
            rotation=(0.0, pitch, yaw),
        )


def populate_palm_trees(col, mats):
    """Place 95+ tropical Royal Palm trees across KLCC Park, Lake Symphony, and Jalan Ampang median."""
    palm_coords = []

    for x in range(-144, 150, 12):
        if abs(x - (-38)) > 9 and abs(x - 18) > 8:
            palm_coords.append((float(x), -89.5, 0.25, 0.95))

    for x in range(-136, 142, 14):
        if abs(x - (-38)) > 10 and abs(x - 18) > 9:
            palm_coords.append((float(x), -76.5, 0.20, 1.05))
            palm_coords.append((float(x), -103.5, 0.20, 1.00))

    park_ring = [
        (-30, -62), (-25, -56), (-28, -48), (-24, -40),
        (36, -62), (40, -55), (42, -47), (38, -39), (46, -52),
        (-16, -63), (-6, -64), (14, -64), (24, -63),
        (-48, -58), (-52, -46), (-46, -36),
        (52, -58), (56, -45), (50, -35),
    ]
    for px, py in park_ring:
        palm_coords.append((float(px), float(py), 0.25, random.uniform(0.90, 1.22)))

    for idx, (px, py, pz, sc) in enumerate(palm_coords):
        create_royal_palm_tree(f"RoyalPalm_{idx+1:03d}", (px, py, pz), sc, col, mats)


# ==============================================================================
# 3. MULTI-LANE ROADS, INTERSECTIONS & 62 ANIMATED 3D VEHICLES
# ==============================================================================

def build_roads_and_intersections(col, mats):
    """
    Build Jalan Ampang 6-lane divided boulevard, Persiaran KLCC 4-lane cross-avenue,
    Suria KLCC drop-off loop, zebra crosswalks, lane stripes, and traffic light gantries.
    """
    create_box(
        "KLCC_Urban_Ground",
        (520.0, 440.0, 0.2),
        (0.0, 0.0, -0.1),
        material=mats["urban_ground"],
        collection=col,
    )

    # 1. Jalan Ampang 6-Lane Boulevard (Y = -89.5m, width = 22.5m, X = -240m to +240m)
    create_box(
        "Jalan_Ampang_Asphalt",
        (480.0, 22.5, 0.14),
        (0.0, -89.5, 0.07),
        material=mats["asphalt"],
        collection=col,
    )
    for seg_idx, (x0, x1) in enumerate([(-220.0, -47.0), (-29.0, 9.0), (27.0, 220.0)]):
        create_box(
            f"Jalan_Ampang_Median_{seg_idx}",
            (x1 - x0, 1.8, 0.32),
            (0.5 * (x0 + x1), -89.5, 0.16),
            material=mats["concrete_light"],
            collection=col,
        )

    create_box("Jalan_Ampang_Sidewalk_North", (460.0, 3.6, 0.24), (0.0, -76.4, 0.12), material=mats["sidewalk"], collection=col)
    create_box("Jalan_Ampang_Sidewalk_South", (460.0, 3.6, 0.24), (0.0, -102.6, 0.12), material=mats["sidewalk"], collection=col)

    for lane_y in (-96.8, -93.6, -85.4, -82.2):
        for x_dash in range(-180, 185, 9):
            if abs(x_dash - (-38)) > 9 and abs(x_dash - 18) > 8:
                create_box(
                    f"LaneDash_JA_{int(lane_y)}_{x_dash}",
                    (4.2, 0.18, 0.16),
                    (float(x_dash), lane_y, 0.085),
                    material=mats["road_paint_white"],
                    collection=col,
                )

    # 2. Persiaran KLCC / Jalan P. Ramlee 4-Lane Cross-Avenue (X = -38.0m)
    create_box(
        "Persiaran_KLCC_Asphalt",
        (15.5, 240.0, 0.15),
        (-38.0, -60.0, 0.075),
        material=mats["asphalt"],
        collection=col,
    )
    create_box("Persiaran_Sidewalk_West", (3.2, 220.0, 0.24), (-47.3, -60.0, 0.12), material=mats["sidewalk"], collection=col)
    create_box("Persiaran_Sidewalk_East", (3.2, 160.0, 0.24), (-28.7, -50.0, 0.12), material=mats["sidewalk"], collection=col)

    for y_dash in range(-160, 45, 9):
        if abs(y_dash - (-89.5)) > 13:
            create_box(
                f"LaneDash_PKLCC_{y_dash}",
                (0.22, 4.2, 0.17),
                (-38.0, float(y_dash), 0.09),
                material=mats["road_paint_gold"],
                collection=col,
            )

    # 3. Suria KLCC VIP Drop-Off Loop Driveway (Y = -69.5m, X = -38m to +48m)
    create_box(
        "Suria_DropOff_Driveway",
        (92.0, 8.2, 0.15),
        (5.0, -69.5, 0.075),
        material=mats["asphalt"],
        collection=col,
    )
    create_box(
        "Suria_Connector_Road",
        (12.5, 24.0, 0.15),
        (18.0, -79.0, 0.075),
        material=mats["asphalt"],
        collection=col,
    )

    # 4. High-Contrast White Zebra Crosswalks
    for cw_idx, cw_x in enumerate([-49.5, -26.5, 9.5, 26.5]):
        for s_i in range(11):
            sy = -99.5 + s_i * 2.0
            create_box(
                f"Zebra_JA_{cw_idx}_{s_i}",
                (3.4, 0.85, 0.17),
                (cw_x, sy, 0.09),
                material=mats["road_paint_white"],
                collection=col,
            )

    for cw_idx, cw_y in enumerate([-76.5, -102.5, -69.5]):
        for s_i in range(7):
            sx = -44.0 + s_i * 2.0
            create_box(
                f"Zebra_PK_{cw_idx}_{s_i}",
                (0.85, 3.2, 0.17),
                (sx, cw_y, 0.09),
                material=mats["road_paint_white"],
                collection=col,
            )

    # 5. Overhead Traffic Light Gantries & Boulevard Streetlamps
    gantry_locs = [(-48.0, -77.5, 0.0), (-28.0, -101.5, math.pi), (10.0, -77.5, 0.0), (26.0, -101.5, math.pi)]
    for g_idx, (gx, gy, g_rot) in enumerate(gantry_locs):
        create_cylinder(
            f"Traffic_Pole_{g_idx}",
            0.22,
            0.18,
            6.8,
            (gx, gy, 3.4),
            segments=10,
            material=mats["stainless_steel"],
            collection=col,
        )
        arm_dir = -1.0 if g_rot == 0.0 else 1.0
        create_box(
            f"Traffic_Arm_{g_idx}",
            (0.22, 7.5, 0.22),
            (gx, gy + arm_dir * 3.7, 6.4),
            material=mats["stainless_steel"],
            collection=col,
        )
        for sig_i, (sig_mat, offset_y) in enumerate([
            (mats["taillight_red"], 2.4),
            (mats["fountain_gold"], 4.4),
            (mats["signal_green"], 6.4),
        ]):
            create_sphere(
                f"Traffic_Signal_{g_idx}_{sig_i}",
                0.24,
                (gx, gy + arm_dir * offset_y, 6.15),
                material=sig_mat,
                collection=col,
            )

    for sl_idx, x_lamp in enumerate(range(-110, 115, 22)):
        for y_lamp in (-75.8, -103.2):
            create_cylinder(
                f"StreetPole_{sl_idx}_{int(y_lamp)}",
                0.14,
                0.10,
                7.2,
                (float(x_lamp), y_lamp, 3.6),
                segments=8,
                material=mats["stainless_steel"],
                collection=col,
            )
            create_box(
                f"StreetLuminaire_{sl_idx}_{int(y_lamp)}",
                (0.6, 1.2, 0.18),
                (float(x_lamp), y_lamp + (1.0 if y_lamp > -89 else -1.0) * 0.6, 7.2),
                material=mats["headlight_white"],
                collection=col,
            )


def create_detailed_vehicle(
    v_name,
    v_type,
    body_mat,
    col,
    mats,
    with_road_light=False,
):
    """
    Build a detailed 3D vehicle hierarchy:
    - 'sedan', 'suv', 'taxi', or 'bus'
    - Sculpted lower chassis + tapered aerodynamic cabin greenhouse with dark glass windows
    - Front radiator grille, bumper, side mirrors, license plates, shark-fin antenna
    - Warm-white LED headlights, amber turn signals, ruby-red LED taillights
    - 4 separate 3D wheel assemblies (tire + silver alloy rim) that rotate as the car moves!
    """
    root = bpy.data.objects.new(v_name, None)
    root.empty_display_size = 0.5
    col.objects.link(root)

    if v_type == "bus":
        length, width, chassis_h, cabin_h = 10.6, 2.52, 1.15, 1.85
        wheel_x_off, wheel_y_off, wheel_r = 3.2, 1.22, 0.52
    elif v_type == "suv":
        length, width, chassis_h, cabin_h = 4.78, 1.96, 0.76, 0.72
        wheel_x_off, wheel_y_off, wheel_r = 1.48, 0.94, 0.39
    elif v_type == "taxi":
        length, width, chassis_h, cabin_h = 4.58, 1.84, 0.64, 0.62
        wheel_x_off, wheel_y_off, wheel_r = 1.38, 0.88, 0.34
    else:  # sedan
        length, width, chassis_h, cabin_h = 4.64, 1.86, 0.64, 0.60
        wheel_x_off, wheel_y_off, wheel_r = 1.42, 0.89, 0.34

    z_base = wheel_r * 0.72

    # 1. Lower Sculpted Body Chassis + Front & Rear Bumpers
    chassis = create_tapered_box(
        f"{v_name}_Chassis",
        (length, width),
        (length * 0.96, width * 0.94),
        chassis_h,
        (0.0, 0.0, z_base + chassis_h * 0.5),
        offset_top_x=-0.05,
        material=body_mat,
        collection=col,
    )
    chassis.parent = root

    # Front dark grille & license plate
    grille = create_box(
        f"{v_name}_Grille",
        (0.10, width * 0.46, chassis_h * 0.45),
        (length * 0.495, 0.0, z_base + chassis_h * 0.45),
        material=mats["tire_black"],
        collection=col,
    )
    grille.parent = root

    # 2. Tapered Aerodynamic Cabin Greenhouse & Windows
    if v_type == "bus":
        cabin_glass = create_box(
            f"{v_name}_BusWindows",
            (length * 0.96, width * 0.98, cabin_h * 0.72),
            (0.0, 0.0, z_base + chassis_h + cabin_h * 0.38),
            material=mats["bus_window_glow"],
            collection=col,
        )
        cabin_glass.parent = root
        roof_cap = create_box(
            f"{v_name}_BusRoof",
            (length * 0.98, width, cabin_h * 0.28),
            (0.0, 0.0, z_base + chassis_h + cabin_h * 0.86),
            material=body_mat,
            collection=col,
        )
        roof_cap.parent = root
        dest_led = create_box(
            f"{v_name}_RouteDisplay",
            (0.14, width * 0.62, 0.32),
            (length * 0.49, 0.0, z_base + chassis_h + cabin_h * 0.82),
            material=mats["fountain_gold"],
            collection=col,
        )
        dest_led.parent = root
    else:
        cabin_len_bot = length * (0.66 if v_type == "suv" else 0.58)
        cabin_len_top = cabin_len_bot * (0.76 if v_type == "suv" else 0.64)
        cabin_x = -length * (0.09 if v_type == "suv" else 0.06)

        # Sloped windshield/side/rear glass greenhouse
        greenhouse = create_tapered_box(
            f"{v_name}_Greenhouse",
            (cabin_len_bot, width * 0.88),
            (cabin_len_top, width * 0.76),
            cabin_h,
            (cabin_x, 0.0, z_base + chassis_h + cabin_h * 0.48),
            offset_top_x=-0.12,
            material=mats["car_glass"],
            collection=col,
        )
        greenhouse.parent = root

        # Metallic roof panel (white roof for KL red-and-white Taxis!)
        roof_mat = mats["car_white"] if v_type == "taxi" else body_mat
        roof = create_box(
            f"{v_name}_Roof",
            (cabin_len_top * 0.96, width * 0.75, 0.09),
            (cabin_x - 0.12, 0.0, z_base + chassis_h + cabin_h * 0.98),
            material=roof_mat,
            collection=col,
        )
        roof.parent = root

        # Side mirrors (Left & Right)
        for sy in (-1.0, 1.0):
            mirror = create_box(
                f"{v_name}_Mirror_{int(sy)}",
                (0.20, 0.18, 0.13),
                (length * 0.15, sy * (width * 0.53), z_base + chassis_h + 0.10),
                material=body_mat,
                collection=col,
            )
            mirror.parent = root

        if v_type == "taxi":
            taxi_sign = create_box(
                f"{v_name}_TaxiSign",
                (0.34, 0.64, 0.20),
                (cabin_x, 0.0, z_base + chassis_h + cabin_h + 0.13),
                material=mats["fountain_gold"],
                collection=col,
            )
            taxi_sign.parent = root

    # 3. Front Headlights (Warm-White LED) & Rear Taillights (Ruby-Red LED)
    hl_y = width * 0.36
    hl_z = z_base + chassis_h * 0.58
    for sy in (-1.0, 1.0):
        hl = create_box(
            f"{v_name}_Headlight_{int(sy)}",
            (0.12, 0.36, 0.20),
            (length * 0.495, sy * hl_y, hl_z),
            material=mats["headlight_white"],
            collection=col,
        )
        hl.parent = root

        tl = create_box(
            f"{v_name}_Taillight_{int(sy)}",
            (0.12, 0.40, 0.20),
            (-length * 0.495, sy * hl_y, hl_z + 0.04),
            material=mats["taillight_red"],
            collection=col,
        )
        tl.parent = root

    rear_bar = create_box(
        f"{v_name}_RearLightBar",
        (0.08, width * 0.74, 0.08),
        (-length * 0.498, 0.0, hl_z + 0.08),
        material=mats["taillight_red"],
        collection=col,
    )
    rear_bar.parent = root

    # 4. Four Rotating 3D Wheels (Tire + Silver Alloy Hubcap)
    wheels = []
    for wx_sign in (-1.0, 1.0):
        for wy_sign in (-1.0, 1.0):
            wx = wx_sign * wheel_x_off
            wy = wy_sign * wheel_y_off
            w_obj = create_cylinder(
                f"{v_name}_Wheel_{int(wx_sign)}_{int(wy_sign)}",
                wheel_r,
                wheel_r,
                0.28,
                (wx, wy, wheel_r),
                segments=16,
                material=mats["tire_black"],
                collection=col,
                rotation=(math.pi * 0.5, 0.0, 0.0),
            )
            w_obj.parent = root
            hub = create_box(
                f"{v_name}_Rim_{int(wx_sign)}_{int(wy_sign)}",
                (wheel_r * 1.35, 0.31, wheel_r * 0.32),
                (0.0, 0.0, 0.0),
                material=mats["stainless_steel"],
                collection=col,
            )
            hub.parent = w_obj
            wheels.append((w_obj, wheel_r))

    # Subtle shadowless road light pool in front of hero vehicles
    if with_road_light:
        l_data = bpy.data.lights.new(name=f"{v_name}_RoadLight", type='POINT')
        l_data.color = (1.0, 0.92, 0.76)
        l_data.energy = 110.0
        l_data.use_shadow = False
        l_obj = bpy.data.objects.new(name=f"{v_name}_RoadLight", object_data=l_data)
        l_obj.location = (length * 0.78, 0.0, 0.85)
        col.objects.link(l_obj)
        l_obj.parent = root

    return root, wheels


def animate_straight_vehicle(root, wheels, start_pos, end_pos, col):
    """Animate a vehicle and its rotating wheels along a straight lane from frame 1 to 240."""
    p0 = Vector(start_pos)
    p1 = Vector(end_pos)
    diff = p1 - p0
    dist = diff.length
    yaw = math.atan2(diff.y, diff.x)

    root.rotation_euler = (0.0, 0.0, yaw)
    root.location = p0
    root.keyframe_insert(data_path="location", frame=FRAME_START)
    root.location = p1
    root.keyframe_insert(data_path="location", frame=FRAME_END)

    if root.animation_data and root.animation_data.action:
        for fcurve in getattr(root.animation_data.action, "fcurves", []):
            for kp in fcurve.keyframe_points:
                kp.interpolation = 'LINEAR'

    for w_obj, w_rad in wheels:
        total_angle = dist / max(w_rad, 0.2)
        w_obj.rotation_euler = (math.pi * 0.5, 0.0, 0.0)
        w_obj.keyframe_insert(data_path="rotation_euler", frame=FRAME_START)
        w_obj.rotation_euler = (math.pi * 0.5, total_angle, 0.0)
        w_obj.keyframe_insert(data_path="rotation_euler", frame=FRAME_END)


def animate_curved_vehicle(root, wheels, control_pts, frame_offset=0, speed_scale=1.0):
    """Animate a vehicle smoothly turning along a cubic Bezier path."""
    p0, p1, p2, p3 = [Vector(p) for p in control_pts]

    def bezier(t):
        u = 1.0 - t
        return (u**3) * p0 + 3 * (u**2) * t * p1 + 3 * u * (t**2) * p2 + (t**3) * p3

    prev_pos = None
    cum_dist = 0.0
    for f in range(FRAME_START, FRAME_END + 1, 6):
        raw_t = ((f - FRAME_START) * speed_scale + frame_offset) / (FRAME_END - FRAME_START)
        t = raw_t % 1.0
        pos = bezier(t)
        pos_next = bezier(min(1.0, t + 0.01))
        tangent = pos_next - pos
        yaw = math.atan2(tangent.y, tangent.x)

        if prev_pos is not None and (pos - prev_pos).length < 25.0:
            cum_dist += (pos - prev_pos).length
        prev_pos = pos

        root.location = pos
        root.rotation_euler = (0.0, 0.0, yaw)
        root.keyframe_insert(data_path="location", frame=f)
        root.keyframe_insert(data_path="rotation_euler", frame=f)

        for w_obj, w_rad in wheels:
            w_obj.rotation_euler = (math.pi * 0.5, cum_dist / w_rad, 0.0)
            w_obj.keyframe_insert(data_path="rotation_euler", frame=f)


def build_all_traffic(col, mats):
    """
    Create 62 animated 3D vehicles (Sedans, SUVs, KL Red/White Taxis, RapidKL/GoKL Buses)
    across Jalan Ampang, Persiaran KLCC, and the Suria KLCC Drop-Off Loop.
    """
    car_palette = [
        mats["car_silver"],
        mats["car_white"],
        mats["car_blue"],
        mats["car_red"],
        mats["car_gold"],
        mats["car_dark"],
        mats["car_emerald"],
    ]

    v_count = 0

    # 1. Jalan Ampang 3 Eastbound Lanes (Y = -98.4, -95.2, -92.0) -> moving +X
    eb_lanes = [-98.4, -95.2, -92.0]
    for l_idx, ly in enumerate(eb_lanes):
        num_cars = 7
        for i in range(num_cars):
            v_count += 1
            x_start = -135.0 + i * 34.0 + (l_idx * 9.0)
            speed_dist = 95.0 + (l_idx * 16.0) + (i % 3) * 8.0
            x_end = x_start + speed_dist

            if i == 2 and l_idx == 0:
                v_type, b_mat = "bus", mats["bus_magenta"]
            elif (i + l_idx) % 4 == 0:
                v_type, b_mat = "taxi", mats["car_red"]
            elif (i + l_idx) % 3 == 0:
                v_type, b_mat = "suv", car_palette[(v_count) % len(car_palette)]
            else:
                v_type, b_mat = "sedan", car_palette[(v_count) % len(car_palette)]

            near_cam = (-75.0 <= x_start <= 25.0)
            root, wheels = create_detailed_vehicle(
                f"Vehicle_EB_{v_count:02d}_{v_type}",
                v_type,
                b_mat,
                col,
                mats,
                with_road_light=near_cam and (v_count % 2 == 0),
            )
            animate_straight_vehicle(root, wheels, (x_start, ly, 0.14), (x_end, ly, 0.14), col)

    # 2. Jalan Ampang 3 Westbound Lanes (Y = -87.0, -83.8, -80.6) -> moving -X
    wb_lanes = [-87.0, -83.8, -80.6]
    for l_idx, ly in enumerate(wb_lanes):
        num_cars = 7
        for i in range(num_cars):
            v_count += 1
            x_start = 135.0 - i * 34.0 - (l_idx * 8.0)
            speed_dist = 92.0 + (l_idx * 15.0) + (i % 3) * 9.0
            x_end = x_start - speed_dist

            if i == 1 and l_idx == 2:
                v_type, b_mat = "bus", mats["bus_blue"]
            elif (i + l_idx) % 4 == 1:
                v_type, b_mat = "taxi", mats["car_red"]
            elif (i + l_idx) % 3 == 1:
                v_type, b_mat = "suv", car_palette[(v_count) % len(car_palette)]
            else:
                v_type, b_mat = "sedan", car_palette[(v_count) % len(car_palette)]

            near_cam = (-65.0 <= x_start <= 45.0)
            root, wheels = create_detailed_vehicle(
                f"Vehicle_WB_{v_count:02d}_{v_type}",
                v_type,
                b_mat,
                col,
                mats,
                with_road_light=near_cam and (v_count % 2 == 1),
            )
            animate_straight_vehicle(root, wheels, (x_start, ly, 0.14), (x_end, ly, 0.14), col)

    # 3. Persiaran KLCC Northbound & Southbound Lanes (X = -43.2, -40.2, -35.8, -32.8)
    pklcc_lanes = [
        (-43.2, -1.0),
        (-40.2, -1.0),
        (-35.8, 1.0),
        (-32.8, 1.0),
    ]
    for l_idx, (lx, dir_y) in enumerate(pklcc_lanes):
        for i in range(3):
            v_count += 1
            if dir_y > 0:
                y_start = -145.0 + i * 42.0 + l_idx * 7.0
                y_end = y_start + 82.0
            else:
                y_start = -15.0 - i * 42.0 - l_idx * 6.0
                y_end = y_start - 82.0

            v_type = "taxi" if i == 1 else ("suv" if l_idx % 2 == 0 else "sedan")
            b_mat = mats["car_red"] if v_type == "taxi" else car_palette[v_count % len(car_palette)]
            root, wheels = create_detailed_vehicle(
                f"Vehicle_PKLCC_{v_count:02d}_{v_type}",
                v_type,
                b_mat,
                col,
                mats,
                with_road_light=(i == 1),
            )
            animate_straight_vehicle(root, wheels, (lx, y_start, 0.15), (lx, y_end, 0.15), col)

    # 4. Suria KLCC Drop-Off Loop & Intersection Turning Vehicles (8 hero vehicles right under the drone!)
    curve_dropoff_east = [(-35.8, -96.0, 0.15), (-35.8, -71.0, 0.15), (-10.0, -71.0, 0.15), (42.0, -71.0, 0.15)]
    for i in range(4):
        v_count += 1
        v_type = ["taxi", "suv", "sedan", "bus"][i]
        b_mat = mats["car_red"] if v_type == "taxi" else (mats["bus_magenta"] if v_type == "bus" else car_palette[i])
        root, wheels = create_detailed_vehicle(
            f"Vehicle_DropOff_East_{v_count:02d}_{v_type}",
            v_type,
            b_mat,
            col,
            mats,
            with_road_light=True,
        )
        animate_curved_vehicle(root, wheels, curve_dropoff_east, frame_offset=i * 58, speed_scale=0.85)

    curve_dropoff_west = [(42.0, -68.0, 0.15), (5.0, -68.0, 0.15), (-40.2, -68.0, 0.15), (-40.2, -118.0, 0.15)]
    for i in range(4):
        v_count += 1
        v_type = ["sedan", "taxi", "suv", "sedan"][i]
        b_mat = mats["car_red"] if v_type == "taxi" else car_palette[(i + 3) % len(car_palette)]
        root, wheels = create_detailed_vehicle(
            f"Vehicle_DropOff_West_{v_count:02d}_{v_type}",
            v_type,
            b_mat,
            col,
            mats,
            with_road_light=(i % 2 == 0),
        )
        animate_curved_vehicle(root, wheels, curve_dropoff_west, frame_offset=i * 55 + 20, speed_scale=0.85)


# ==============================================================================
# 4. ARTICULATED 3D WALKING PEDESTRIANS (108 REAL WALKING PEOPLE)
# ==============================================================================

def create_walking_pedestrian(
    p_name,
    start_pos,
    end_pos,
    shirt_mat,
    pants_mat,
    skin_mat,
    hair_mat,
    col,
    mats,
    phase_offset=0.0,
    scale=1.0,
    has_bag=False,
):
    """
    Build an articulated 3D pedestrian (~1.8m tall) with:
    - Root mover + subtle walk bounce
    - Head + Hair/Hijab/Cap
    - Torso / Jacket + Backpack/Collar
    - Left & Right Arms pivoting at shoulders with hands
    - Left & Right Legs pivoting at hips with shoes
    - Optional Suria KLCC shopping bag
    """
    root = bpy.data.objects.new(p_name, None)
    root.empty_display_size = 0.25
    col.objects.link(root)

    torso = create_cylinder(
        f"{p_name}_Torso",
        0.19 * scale,
        0.22 * scale,
        0.58 * scale,
        (0.0, 0.0, 1.17 * scale),
        segments=10,
        material=shirt_mat,
        collection=col,
    )
    torso.scale.y = 1.25
    torso.parent = root

    head = create_sphere(
        f"{p_name}_Head",
        0.145 * scale,
        (0.0, 0.0, 1.62 * scale),
        segments=10,
        ring_count=8,
        material=skin_mat,
        collection=col,
    )
    head.parent = root

    hair = create_sphere(
        f"{p_name}_Hair",
        0.154 * scale,
        (-0.015 * scale, 0.0, 1.66 * scale),
        segments=10,
        ring_count=8,
        material=hair_mat,
        collection=col,
    )
    hair.scale.z = 0.78
    hair.parent = root

    arms = []
    for side_idx, sy in enumerate((-1.0, 1.0)):
        arm_pivot = bpy.data.objects.new(f"{p_name}_ArmPivot_{side_idx}", None)
        arm_pivot.empty_display_size = 0.1
        arm_pivot.location = (0.0, sy * 0.27 * scale, 1.42 * scale)
        col.objects.link(arm_pivot)
        arm_pivot.parent = root

        arm_mesh = create_cylinder(
            f"{p_name}_Arm_{side_idx}",
            0.062 * scale,
            0.052 * scale,
            0.54 * scale,
            (0.0, 0.0, -0.26 * scale),
            segments=8,
            material=shirt_mat,
            collection=col,
        )
        arm_mesh.parent = arm_pivot

        hand = create_sphere(
            f"{p_name}_Hand_{side_idx}",
            0.055 * scale,
            (0.0, 0.0, -0.54 * scale),
            segments=8,
            ring_count=6,
            material=skin_mat,
            collection=col,
        )
        hand.parent = arm_pivot

        if has_bag and side_idx == 1:
            bag = create_box(
                f"{p_name}_ShoppingBag",
                (0.24 * scale, 0.10 * scale, 0.30 * scale),
                (0.0, 0.06 * scale, -0.70 * scale),
                material=mats["cloth_gold"],
                collection=col,
            )
            bag.parent = arm_pivot

        arms.append(arm_pivot)

    legs = []
    for side_idx, sy in enumerate((-1.0, 1.0)):
        leg_pivot = bpy.data.objects.new(f"{p_name}_LegPivot_{side_idx}", None)
        leg_pivot.empty_display_size = 0.1
        leg_pivot.location = (0.0, sy * 0.11 * scale, 0.88 * scale)
        col.objects.link(leg_pivot)
        leg_pivot.parent = root

        leg_mesh = create_cylinder(
            f"{p_name}_Leg_{side_idx}",
            0.085 * scale,
            0.068 * scale,
            0.80 * scale,
            (0.0, 0.0, -0.40 * scale),
            segments=8,
            material=pants_mat,
            collection=col,
        )
        leg_mesh.parent = leg_pivot

        shoe = create_box(
            f"{p_name}_Shoe_{side_idx}",
            (0.24 * scale, 0.12 * scale, 0.09 * scale),
            (0.05 * scale, 0.0, -0.83 * scale),
            material=mats["tire_black"],
            collection=col,
        )
        shoe.parent = leg_pivot
        legs.append(leg_pivot)

    p0 = Vector(start_pos)
    p1 = Vector(end_pos)
    diff = p1 - p0
    yaw = math.atan2(diff.y, diff.x)
    root.rotation_euler = (0.0, 0.0, yaw)

    stride_freq = 0.36
    for f in range(FRAME_START, FRAME_END + 1, 4):
        t = (f - FRAME_START) / (FRAME_END - FRAME_START)
        pos = p0.lerp(p1, t)
        phase = f * stride_freq + phase_offset
        bounce = abs(math.sin(phase)) * 0.045 * scale
        root.location = (pos.x, pos.y, pos.z + bounce)
        root.keyframe_insert(data_path="location", frame=f)

        swing = math.sin(phase)
        arms[0].rotation_euler = (0.0, 0.52 * swing, 0.0)
        arms[1].rotation_euler = (0.0, -0.52 * swing, 0.0)
        legs[0].rotation_euler = (0.0, -0.58 * swing, 0.0)
        legs[1].rotation_euler = (0.0, 0.58 * swing, 0.0)

        arms[0].keyframe_insert(data_path="rotation_euler", frame=f)
        arms[1].keyframe_insert(data_path="rotation_euler", frame=f)
        legs[0].keyframe_insert(data_path="rotation_euler", frame=f)
        legs[1].keyframe_insert(data_path="rotation_euler", frame=f)

    return root


def build_all_pedestrians(col, mats):
    """
    Populate 108 articulated 3D walking pedestrians across:
    1. Jalan Ampang & Persiaran KLCC Zebra Crosswalks
    2. Jalan Ampang & Persiaran KLCC Sidewalks
    3. Suria KLCC Drop-Off & Esplanade Waterside Promenade
    4. Lake Symphony Elevated Curved Pedestrian Bridge
    """
    shirt_palette = [
        mats["cloth_white"],
        mats["cloth_coral"],
        mats["cloth_teal"],
        mats["cloth_gold"],
        mats["cloth_royal"],
        mats["cloth_lavender"],
        mats["cloth_mint"],
    ]
    pants_palette = [
        mats["pants_navy"],
        mats["pants_charcoal"],
        mats["pants_khaki"],
    ]
    skin_palette = [mats["skin_warm"], mats["skin_tan"], mats["skin_light"]]
    hair_palette = [mats["tire_black"], mats["cloth_white"], mats["cloth_coral"], mats["pants_navy"]]

    ped_paths = []

    # 1. Zebra Crosswalks at Jalan Ampang & Persiaran KLCC (32 pedestrians)
    for i in range(8):
        y0 = -101.5 + (i % 4) * 2.2
        y1 = y0 + 14.5
        if i % 2 == 1:
            y0, y1 = -77.5 - (i % 4) * 2.2, -77.5 - (i % 4) * 2.2 - 14.5
        ped_paths.append(((-49.5 + (i - 3.5) * 0.35, y0, 0.20), (-49.5 + (i - 3.5) * 0.35, y1, 0.20)))

    for i in range(8):
        y0 = -101.0 + (i % 4) * 2.4
        y1 = y0 + 15.0
        if i % 2 == 0:
            y0, y1 = -78.0 - (i % 4) * 2.0, -78.0 - (i % 4) * 2.0 - 15.0
        ped_paths.append(((-26.5 + (i - 3.5) * 0.35, y0, 0.20), (-26.5 + (i - 3.5) * 0.35, y1, 0.20)))

    for i in range(8):
        x0 = -45.5 + (i % 4) * 2.0
        x1 = x0 + 12.5
        cy = -76.5 if i < 4 else -69.5
        if i % 2 == 1:
            x0, x1 = -31.0 - (i % 4) * 1.8, -31.0 - (i % 4) * 1.8 - 12.5
        ped_paths.append(((x0, cy + (i - 3.5) * 0.3, 0.22), (x1, cy + (i - 3.5) * 0.3, 0.22)))

    for i in range(8):
        cx = 9.5 if i < 4 else 26.5
        y0 = -100.5 + (i % 4) * 2.5
        y1 = y0 + 14.5
        if i % 2 == 1:
            y0, y1 = y1, y0
        ped_paths.append(((cx + (i % 3 - 1) * 0.4, y0, 0.20), (cx + (i % 3 - 1) * 0.4, y1, 0.20)))

    # 2. Jalan Ampang North & South Sidewalk Promenades (30 pedestrians)
    for i in range(18):
        x0 = -78.0 + i * 7.5
        x1 = x0 + (15.0 if i % 2 == 0 else -15.0)
        sy = -76.2 + (i % 3 - 1) * 0.65
        ped_paths.append(((x0, sy, 0.24), (x1, sy, 0.24)))

    for i in range(12):
        x0 = -68.0 + i * 9.5
        x1 = x0 + (-14.0 if i % 2 == 0 else 14.0)
        sy = -102.5 + (i % 3 - 1) * 0.65
        ped_paths.append(((x0, sy, 0.24), (x1, sy, 0.24)))

    # 3. Suria KLCC Drop-Off Entrance & Esplanade Waterside Promenade (24 pedestrians)
    for i in range(12):
        x0 = -32.0 + i * 6.2
        x1 = x0 + (13.0 if i % 2 == 0 else -13.0)
        sy = -64.8 + (i % 3 - 1) * 0.55
        ped_paths.append(((x0, sy, 0.26), (x1, sy, 0.26)))

    for i in range(12):
        x0 = -28.0 + i * 5.4
        x1 = x0 + (12.0 if i % 2 == 1 else -12.0)
        sy = -36.5 + (i % 3 - 1) * 0.65
        ped_paths.append(((x0, sy, 0.34), (x1, sy, 0.34)))

    # 4. Lake Symphony Elevated Curved Pedestrian Bridge (22 pedestrians walking across the bridge!)
    for i in range(22):
        t0 = 0.06 + (i / 22.0) * 0.82
        t1 = min(0.94, max(0.05, t0 + (0.16 if i % 2 == 0 else -0.16)))

        def bridge_pt(t, lane_off):
            bx = -22.0 + 54.0 * t
            by = -52.5 + 5.2 * math.sin(math.pi * t) + lane_off
            bz = 0.60 + 2.65 * math.sin(math.pi * t)
            return (bx, by, bz)

        lane = (i % 3 - 1) * 0.55
        ped_paths.append((bridge_pt(t0, lane), bridge_pt(t1, lane)))

    for idx, (p_start, p_end) in enumerate(ped_paths):
        create_walking_pedestrian(
            f"Pedestrian_{idx+1:03d}",
            p_start,
            p_end,
            shirt_palette[idx % len(shirt_palette)],
            pants_palette[idx % len(pants_palette)],
            skin_palette[idx % len(skin_palette)],
            hair_palette[idx % len(hair_palette)],
            col,
            mats,
            phase_offset=idx * 0.75,
            scale=random.uniform(0.94, 1.08),
            has_bag=(idx % 3 == 0),
        )


# ==============================================================================
# 5. 10-SECOND CINEMA DRONE CAMERA & LEAD QUADCOPTER DRONE
# ==============================================================================

def build_drone_and_camera(col, mats):
    """
    Create the 10-second (240 frames @ 24 FPS) Drone Camera trajectory
    plus a physical 3D Quadcopter Cinema Drone banking ahead in the upper corner.
    """
    scene = bpy.context.scene

    cam_target = bpy.data.objects.new("Drone_Gimbal_Target", None)
    cam_target.empty_display_size = 2.0
    col.objects.link(cam_target)

    # 16mm ultra-wide cinema drone lens so street-level cars/people AND 198m towers fit cleanly!
    cam_data = bpy.data.cameras.new("Drone_Camera")
    cam_data.lens = 16.0
    cam_data.clip_start = 0.2
    cam_data.clip_end = 1500.0
    cam_obj = bpy.data.objects.new("Drone_Camera", cam_data)
    col.objects.link(cam_obj)
    scene.camera = cam_obj

    track = cam_obj.constraints.new(type='TRACK_TO')
    track.target = cam_target
    track.track_axis = 'TRACK_NEGATIVE_Z'
    track.up_axis = 'UP_Y'

    # Camera Path Keyframes (Frames 1 to 240):
    # - Frames 1-85: Low-altitude street pass over Jalan Ampang traffic & crosswalk pedestrians,
    #   gliding across the Suria KLCC drop-off loop toward Lake Symphony.
    # - Frames 85-165: Ascending banking arc over Lake Symphony's dancing fountains, curved
    #   pedestrian bridge (with walking people!), and KLCC Park palms, revealing the Skybridge.
    # - Frames 165-240: High-altitude heroic pull-back orbit capturing the ENTIRE Petronas Twin
    #   Towers from street level & Lake Symphony up to the 198.5m spire tips, plus KL skyline.
    cam_keyframes = [
        # (frame, cam_loc, target_loc)
        (1,   (-43.5, -108.5, 4.6),  (-22.0, -72.0, 9.0)),
        (40,  (-26.0, -90.0,  6.5),  (-10.0, -54.0, 14.0)),
        (80,  (-8.0,  -75.0,  10.5), (0.0,   -40.0, 19.0)),
        (120, (14.0,  -78.0,  15.5), (1.0,   -28.0, 28.0)),
        (165, (28.0,  -112.0, 38.0), (0.0,   -16.0, 56.0)),
        (205, (18.0,  -158.0, 58.0), (0.0,   -8.0,  76.0)),
        (240, (10.0,  -184.0, 70.0), (0.0,   -4.0,  82.0)),
    ]

    for frame, c_loc, t_loc in cam_keyframes:
        cam_obj.location = c_loc
        cam_obj.keyframe_insert(data_path="location", frame=frame)
        cam_target.location = t_loc
        cam_target.keyframe_insert(data_path="location", frame=frame)

    for obj in (cam_obj, cam_target):
        if obj.animation_data and obj.animation_data.action:
            for fc in getattr(obj.animation_data.action, "fcurves", []):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'BEZIER'
                    kp.handle_left_type = 'AUTO_CLAMPED'
                    kp.handle_right_type = 'AUTO_CLAMPED'

    # --- Build Physical 3D Cinema Quadcopter Drone ---
    drone_root = bpy.data.objects.new("KLCC_Cinema_Quadcopter", None)
    drone_root.empty_display_size = 0.5
    col.objects.link(drone_root)
    drone_root.scale = (0.72, 0.72, 0.72)

    body = create_tapered_box(
        "Drone_Fuselage",
        (0.50, 0.26),
        (0.36, 0.18),
        0.10,
        (0, 0, 0),
        material=mats["tire_black"],
        collection=col,
    )
    body.parent = drone_root
    led_strip = create_box("Drone_Telemetry_LED", (0.30, 0.20, 0.02), (0, 0, 0.055), material=mats["fountain_cyan"], collection=col)
    led_strip.parent = drone_root

    gimbal = create_sphere("Drone_Gimbal_Pod", 0.075, (0.16, 0.0, -0.08), material=mats["stainless_steel"], collection=col)
    gimbal.parent = drone_root

    rotors = []
    for ax_sign in (-1.0, 1.0):
        for ay_sign in (-1.0, 1.0):
            arm_end = Vector((ax_sign * 0.34, ay_sign * 0.34, 0.02))
            arm_mid = 0.5 * arm_end
            yaw = math.atan2(arm_end.y, arm_end.x)
            arm = create_cylinder(
                f"Drone_Arm_{int(ax_sign)}_{int(ay_sign)}",
                0.020,
                0.016,
                arm_end.length,
                arm_mid,
                segments=8,
                material=mats["stainless_steel"],
                collection=col,
                rotation=(0.0, math.pi * 0.5, yaw),
            )
            arm.parent = drone_root

            motor = create_cylinder(
                f"Drone_Motor_{int(ax_sign)}_{int(ay_sign)}",
                0.038,
                0.034,
                0.055,
                arm_end + Vector((0, 0, 0.02)),
                segments=10,
                material=mats["stainless_steel"],
                collection=col,
            )
            motor.parent = drone_root

            nav_mat = mats["taillight_red"] if ax_sign > 0 else mats["signal_green"]
            nav_led = create_sphere(
                f"Drone_NavLED_{int(ax_sign)}_{int(ay_sign)}",
                0.026,
                arm_end + Vector((0, 0, -0.02)),
                material=nav_mat,
                collection=col,
            )
            nav_led.parent = drone_root

            prop = create_box(
                f"Drone_Rotor_{int(ax_sign)}_{int(ay_sign)}",
                (0.30, 0.032, 0.006),
                arm_end + Vector((0, 0, 0.055)),
                material=mats["stainless_steel"],
                collection=col,
            )
            prop.parent = drone_root
            rotors.append(prop)

    for idx, prop in enumerate(rotors):
        prop.rotation_euler = (0.0, 0.0, 0.0)
        prop.keyframe_insert(data_path="rotation_euler", frame=FRAME_START)
        prop.rotation_euler = (0.0, 0.0, (1.0 if idx % 2 == 0 else -1.0) * 480.0)
        prop.keyframe_insert(data_path="rotation_euler", frame=FRAME_END)

    # Keep the companion quadcopter neatly in the upper-right third so the Twin Towers stay unobstructed
    for f in range(FRAME_START, FRAME_END + 1, 5):
        scene.frame_set(f)
        c_pos = cam_obj.matrix_world.translation.copy()
        t_pos = cam_target.location.copy()
        fwd = (t_pos - c_pos).normalized()
        up = Vector((0.0, 0.0, 1.0))
        right = fwd.cross(up).normalized()
        cam_up = right.cross(fwd).normalized()

        weave = 0.25 * math.sin(f * 0.05)
        drone_pos = c_pos + fwd * 4.5 + right * (2.25 + weave) + cam_up * (1.18 + 0.12 * math.cos(f * 0.06))
        drone_root.location = drone_pos
        yaw = math.atan2(fwd.y, fwd.x)
        bank = -0.22 * math.cos(f * 0.05)
        drone_root.rotation_euler = (bank, 0.14, yaw)
        drone_root.keyframe_insert(data_path="location", frame=f)
        drone_root.keyframe_insert(data_path="rotation_euler", frame=f)

    scene.frame_set(FRAME_START)


# ==============================================================================
# 6. LIGHTING, WORLD SKY, COMPOSITOR BLOOM & RENDER SETTINGS
# ==============================================================================

def setup_world_and_lighting(col):
    """Configure tropical Kuala Lumpur blue-hour twilight sky and balanced architectural lighting."""
    scene = bpy.context.scene

    world = bpy.data.worlds.new("KLCC_Twilight_World")
    scene.world = world
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputWorld")
    bg = nodes.new("ShaderNodeBackground")
    tex_coord = nodes.new("ShaderNodeTexCoord")
    sep_xyz = nodes.new("ShaderNodeSeparateXYZ")
    ramp = nodes.new("ShaderNodeValToRGB")

    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.035, 0.055, 0.13, 1.0)
    ramp.color_ramp.elements[1].position = 0.45
    ramp.color_ramp.elements[1].color = (0.006, 0.012, 0.038, 1.0)

    bg.inputs["Strength"].default_value = 1.25
    links.new(tex_coord.outputs["Generated"], sep_xyz.inputs["Vector"])
    links.new(sep_xyz.outputs["Z"], ramp.inputs["Fac"])
    links.new(ramp.outputs["Color"], bg.inputs["Color"])
    links.new(bg.outputs["Background"], out.inputs["Surface"])

    # 1. Warm Sunset Rim Sun Light (gilding the stainless-steel facets of the Twin Towers)
    sun_data = bpy.data.lights.new(name="KL_Twilight_Sun", type='SUN')
    sun_data.color = (1.0, 0.86, 0.72)
    sun_data.energy = 2.2
    sun_data.angle = math.radians(2.5)
    sun_obj = bpy.data.objects.new(name="KL_Twilight_Sun", object_data=sun_data)
    sun_obj.rotation_euler = (math.radians(64.0), math.radians(-18.0), math.radians(32.0))
    col.objects.link(sun_obj)

    # 2. Cool Blue-Hour Sky Fill Light so street pedestrians & cars are crisp without washing out asphalt
    fill_data = bpy.data.lights.new(name="KL_Sky_Fill", type='SUN')
    fill_data.color = (0.58, 0.78, 1.0)
    fill_data.energy = 1.35
    fill_data.angle = math.radians(15.0)
    fill_data.use_shadow = False
    fill_obj = bpy.data.objects.new(name="KL_Sky_Fill", object_data=fill_data)
    fill_obj.rotation_euler = (math.radians(48.0), math.radians(12.0), math.radians(-24.0))
    col.objects.link(fill_obj)

    # 3. Balanced Architectural Uplights on Twin Towers, Skybridge & Lake Symphony
    flood_specs = [
        ("Tower1_UpLight", (-28.0, -34.0, 32.0), (0.85, 0.94, 1.0), 14000.0, 8.0),
        ("Tower2_UpLight", (28.0, -34.0, 32.0), (0.85, 0.94, 1.0), 14000.0, 8.0),
        ("Tower1_MidLight", (-28.0, -32.0, 118.0), (0.88, 0.95, 1.0), 18000.0, 10.0),
        ("Tower2_MidLight", (28.0, -32.0, 118.0), (0.88, 0.95, 1.0), 18000.0, 10.0),
        ("Tower1_CrownLight", (-28.0, -18.0, 178.0), (0.88, 0.95, 1.0), 12000.0, 6.0),
        ("Tower2_CrownLight", (28.0, -18.0, 178.0), (0.88, 0.95, 1.0), 12000.0, 6.0),
        ("Lake_Fountain_Glow", (5.0, -48.5, 6.0), (0.25, 0.88, 1.0), 1600.0, 5.0),
        ("Intersection_StreetGlow_W", (-38.0, -89.5, 11.0), (1.0, 0.90, 0.74), 1400.0, 5.0),
        ("Intersection_StreetGlow_E", (12.0, -82.0, 11.0), (1.0, 0.90, 0.74), 1200.0, 5.0),
    ]
    for l_name, l_loc, l_col, l_energy, l_size in flood_specs:
        ld = bpy.data.lights.new(name=l_name, type='POINT')
        ld.color = l_col
        ld.energy = l_energy
        ld.shadow_soft_size = l_size
        ld.use_shadow = False
        lo = bpy.data.objects.new(name=l_name, object_data=ld)
        lo.location = l_loc
        col.objects.link(lo)


def setup_compositor_and_render(output_dir):
    """Configure Blender 5.2 EEVEE raytracing, Bloom Glare compositor, and 1080p output."""
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE'
    scene.frame_start = FRAME_START
    scene.frame_end = FRAME_END
    scene.render.fps = FPS
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100

    eevee = scene.eevee
    eevee.taa_render_samples = 32
    eevee.taa_samples = 16
    if hasattr(eevee, "shadow_pool_size"):
        eevee.shadow_pool_size = '1024'
    if hasattr(eevee, "use_raytracing"):
        eevee.use_raytracing = True
    if hasattr(eevee, "use_fast_gi"):
        eevee.use_fast_gi = True

    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - High Contrast'
    scene.view_settings.exposure = 0.0

    # Blender 5.2 Compositor Node Group with subtle cinematic Bloom Glare
    scene.use_nodes = True
    tree = bpy.data.node_groups.new("KLCC_Compositor", "CompositorNodeTree")
    scene.compositing_node_group = tree
    tree.interface.new_socket(name="Image", in_out='OUTPUT', socket_type='NodeSocketColor')

    rl = tree.nodes.new("CompositorNodeRLayers")
    glare = tree.nodes.new("CompositorNodeGlare")
    out = tree.nodes.new("NodeGroupOutput")

    if "Type" in glare.inputs:
        glare.inputs["Type"].default_value = 'Bloom'
    if "Threshold" in glare.inputs:
        glare.inputs["Threshold"].default_value = 1.4
    if "Strength" in glare.inputs:
        glare.inputs["Strength"].default_value = 0.25
    if "Size" in glare.inputs:
        glare.inputs["Size"].default_value = 0.45

    tree.links.new(rl.outputs["Image"], glare.inputs["Image"])
    tree.links.new(glare.outputs["Image"], out.inputs["Image"])

    mp4_path = os.path.join(output_dir, "klcc_drone_flyover_10s.mp4")
    scene.render.filepath = mp4_path
    if hasattr(scene.render.image_settings, "media_type"):
        scene.render.image_settings.media_type = 'VIDEO'
    else:
        scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.ffmpeg.ffmpeg_preset = 'GOOD'


# ==============================================================================
# MAIN SCENE ASSEMBLY & CLI ENTRYPOINT
# ==============================================================================

def create_all_materials():
    """Instantiate all shared PBR and procedural materials."""
    return {
        # Petronas Twin Towers & Skybridge
        "stainless_steel": make_material("Mat_Stainless_Steel", (0.78, 0.82, 0.86), metallic=0.92, roughness=0.20, coat_weight=0.5),
        "tower_facade": make_tower_facade_material("Mat_Petronas_Facade"),
        "tower_crown_glow": make_material("Mat_Tower_Crown_Glow", (0.85, 0.95, 1.0), metallic=0.4, roughness=0.15, emission_color=(0.75, 0.92, 1.0), emission_strength=3.2),
        "skybridge_glow": make_material("Mat_Skybridge_Glow", (0.55, 0.88, 1.0), metallic=0.3, roughness=0.12, emission_color=(0.55, 0.90, 1.0), emission_strength=2.6),
        "warm_glass": make_material("Mat_Warm_Glass", (1.0, 0.86, 0.62), metallic=0.2, roughness=0.15, emission_color=(1.0, 0.84, 0.55), emission_strength=2.4),
        "beacon_red": make_material("Mat_Beacon_Red", (1.0, 0.05, 0.05), roughness=0.2, emission_color=(1.0, 0.08, 0.05), emission_strength=14.0),

        # Suria KLCC & Surrounding Skyline (3D X+Y, Z window grids!)
        "suria_mall_glow": make_skyline_window_material("Mat_Suria_Mall", (0.18, 0.14, 0.10), (1.0, 0.85, 0.55), (1.0, 0.94, 0.80), scale=0.62, strength=2.6),
        "skyline_cool": make_skyline_window_material("Mat_Skyline_Cool", (0.06, 0.14, 0.22), (0.55, 0.86, 1.0), (0.95, 0.92, 0.80), scale=0.62, strength=2.2),
        "skyline_warm": make_skyline_window_material("Mat_Skyline_Warm", (0.14, 0.12, 0.10), (1.0, 0.84, 0.56), (0.78, 0.90, 1.0), scale=0.65, strength=2.2),
        "skyline_gold": make_skyline_window_material("Mat_Skyline_Gold", (0.20, 0.15, 0.08), (1.0, 0.78, 0.42), (1.0, 0.92, 0.74), scale=0.60, strength=2.4),

        # Park, Lake Symphony & Fountains
        "park_grass": make_material("Mat_Park_Grass", (0.04, 0.18, 0.06), roughness=0.82),
        "plaza_stone": make_material("Mat_Plaza_Stone", (0.24, 0.23, 0.22), roughness=0.58),
        "lake_water": make_material("Mat_Lake_Water", (0.015, 0.09, 0.14), metallic=0.15, roughness=0.05, coat_weight=1.0),
        "bridge_deck": make_material("Mat_Bridge_Deck", (0.36, 0.22, 0.12), roughness=0.55),
        "fountain_cyan": make_material("Mat_Fountain_Cyan", (0.15, 0.92, 1.0), roughness=0.15, emission_color=(0.12, 0.88, 1.0), emission_strength=4.2),
        "fountain_gold": make_material("Mat_Fountain_Gold", (1.0, 0.80, 0.22), roughness=0.15, emission_color=(1.0, 0.76, 0.18), emission_strength=4.2),
        "fountain_magenta": make_material("Mat_Fountain_Magenta", (1.0, 0.18, 0.72), roughness=0.15, emission_color=(1.0, 0.18, 0.70), emission_strength=4.2),
        "palm_trunk": make_material("Mat_Palm_Trunk", (0.28, 0.22, 0.16), roughness=0.85),
        "palm_frond": make_material("Mat_Palm_Frond", (0.06, 0.32, 0.10), roughness=0.65),

        # Roads & Infrastructure
        "urban_ground": make_material("Mat_Urban_Ground", (0.04, 0.045, 0.055), roughness=0.85),
        "asphalt": make_material("Mat_Asphalt_Wet", (0.032, 0.035, 0.042), metallic=0.05, roughness=0.32, coat_weight=0.25),
        "sidewalk": make_material("Mat_Sidewalk", (0.22, 0.23, 0.25), roughness=0.68),
        "concrete_light": make_material("Mat_Concrete_Light", (0.42, 0.44, 0.46), roughness=0.62),
        "road_paint_white": make_material("Mat_RoadPaint_White", (0.92, 0.94, 0.96), roughness=0.35, emission_color=(0.85, 0.90, 1.0), emission_strength=0.45),
        "road_paint_gold": make_material("Mat_RoadPaint_Gold", (0.98, 0.76, 0.15), roughness=0.35, emission_color=(1.0, 0.75, 0.15), emission_strength=0.45),

        # Vehicles
        "car_silver": make_material("Mat_Car_Silver", (0.72, 0.75, 0.78), metallic=0.85, roughness=0.18, coat_weight=1.0),
        "car_white": make_material("Mat_Car_White", (0.92, 0.93, 0.95), metallic=0.35, roughness=0.16, coat_weight=1.0),
        "car_blue": make_material("Mat_Car_Blue", (0.06, 0.24, 0.68), metallic=0.75, roughness=0.18, coat_weight=1.0),
        "car_red": make_material("Mat_Car_Red", (0.78, 0.06, 0.08), metallic=0.65, roughness=0.18, coat_weight=1.0),
        "car_gold": make_material("Mat_Car_Gold", (0.76, 0.62, 0.34), metallic=0.80, roughness=0.20, coat_weight=1.0),
        "car_dark": make_material("Mat_Car_Dark", (0.12, 0.14, 0.17), metallic=0.80, roughness=0.18, coat_weight=1.0),
        "car_emerald": make_material("Mat_Car_Emerald", (0.05, 0.42, 0.28), metallic=0.75, roughness=0.18, coat_weight=1.0),
        "bus_magenta": make_material("Mat_Bus_GoKL_Magenta", (0.72, 0.08, 0.48), metallic=0.45, roughness=0.22, coat_weight=0.8),
        "bus_blue": make_material("Mat_Bus_RapidKL_Blue", (0.12, 0.48, 0.85), metallic=0.55, roughness=0.22, coat_weight=0.8),
        "bus_window_glow": make_material("Mat_Bus_Window_Glow", (1.0, 0.92, 0.72), roughness=0.1, emission_color=(1.0, 0.90, 0.68), emission_strength=2.2),
        "car_glass": make_material("Mat_Car_Glass", (0.03, 0.05, 0.08), metallic=0.25, roughness=0.06, coat_weight=1.0),
        "tire_black": make_material("Mat_Tire_Black", (0.035, 0.035, 0.04), roughness=0.75),
        "headlight_white": make_material("Mat_Headlight_White", (1.0, 0.98, 0.90), roughness=0.1, emission_color=(1.0, 0.96, 0.84), emission_strength=8.5),
        "taillight_red": make_material("Mat_Taillight_Red", (1.0, 0.05, 0.05), roughness=0.1, emission_color=(1.0, 0.06, 0.04), emission_strength=8.0),
        "signal_green": make_material("Mat_Signal_Green", (0.10, 1.0, 0.35), roughness=0.1, emission_color=(0.10, 1.0, 0.35), emission_strength=7.5),

        # Pedestrians
        "skin_warm": make_material("Mat_Skin_Warm", (0.76, 0.56, 0.42), roughness=0.55),
        "skin_tan": make_material("Mat_Skin_Tan", (0.62, 0.44, 0.32), roughness=0.55),
        "skin_light": make_material("Mat_Skin_Light", (0.88, 0.70, 0.58), roughness=0.55),
        "cloth_white": make_material("Mat_Cloth_White", (0.92, 0.93, 0.95), roughness=0.65),
        "cloth_coral": make_material("Mat_Cloth_Coral", (0.92, 0.28, 0.26), roughness=0.65),
        "cloth_teal": make_material("Mat_Cloth_Teal", (0.10, 0.65, 0.68), roughness=0.65),
        "cloth_gold": make_material("Mat_Cloth_Gold", (0.95, 0.74, 0.18), roughness=0.65),
        "cloth_royal": make_material("Mat_Cloth_Royal", (0.18, 0.38, 0.88), roughness=0.65),
        "cloth_lavender": make_material("Mat_Cloth_Lavender", (0.68, 0.46, 0.88), roughness=0.65),
        "cloth_mint": make_material("Mat_Cloth_Mint", (0.28, 0.82, 0.54), roughness=0.65),
        "pants_navy": make_material("Mat_Pants_Navy", (0.08, 0.14, 0.28), roughness=0.72),
        "pants_charcoal": make_material("Mat_Pants_Charcoal", (0.14, 0.15, 0.17), roughness=0.72),
        "pants_khaki": make_material("Mat_Pants_Khaki", (0.58, 0.48, 0.34), roughness=0.72),
    }


def build_full_klcc_scene(output_dir):
    print("[KLCC] Resetting scene and creating collections...")
    clear_scene()
    mats = create_all_materials()

    col_towers = get_or_create_collection("01_Petronas_Twin_Towers")
    col_precinct = get_or_create_collection("02_Suria_KLCC_Skyline_Park")
    col_roads = get_or_create_collection("03_Roads_And_Traffic_Cars")
    col_people = get_or_create_collection("04_Walking_Pedestrians")
    col_drone = get_or_create_collection("05_Drone_Camera_And_Lighting")

    print("[KLCC] Building Petronas Twin Towers (Tower 1 & Tower 2) & Double-Deck Skybridge...")
    build_single_petronas_tower("Petronas_Tower_1", (-28.0, 0.0), col_towers, mats)
    build_single_petronas_tower("Petronas_Tower_2", (28.0, 0.0), col_towers, mats)
    build_skybridge(col_towers, mats)

    print("[KLCC] Building Suria KLCC, Surrounding Skyline, KLCC Park, Lake Symphony & Palms...")
    build_suria_klcc_and_skyline(col_precinct, mats)
    build_lake_symphony_and_park(col_precinct, mats)
    populate_palm_trees(col_precinct, mats)

    print("[KLCC] Building Jalan Ampang & Persiaran KLCC Roads and 62 Animated 3D Vehicles...")
    build_roads_and_intersections(col_roads, mats)
    build_all_traffic(col_roads, mats)

    print("[KLCC] Building 108 Articulated 3D Walking Pedestrians...")
    build_all_pedestrians(col_people, mats)

    print("[KLCC] Setting up 10-Second Cinema Drone Camera, Quadcopter Drone & Lighting...")
    build_drone_and_camera(col_drone, mats)
    setup_world_and_lighting(col_drone)
    setup_compositor_and_render(output_dir)

    blend_path = os.path.join(output_dir, "klcc_drone_flyover.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[KLCC] Saved Blender scene to: {blend_path}")
    return blend_path


def render_preview_frames(output_dir, frames=(20, 120, 220)):
    scene = bpy.context.scene
    renders_dir = os.path.join(output_dir, "renders")
    os.makedirs(renders_dir, exist_ok=True)

    if hasattr(scene.render.image_settings, "media_type"):
        scene.render.image_settings.media_type = 'IMAGE'
    scene.render.image_settings.file_format = 'PNG'

    for f in frames:
        scene.frame_set(f)
        out_png = os.path.join(renders_dir, f"frame_{f:04d}.png")
        scene.render.filepath = out_png
        print(f"[KLCC] Rendering preview frame {f} -> {out_png}")
        bpy.ops.render.render(write_still=True)

    mp4_path = os.path.join(output_dir, "klcc_drone_flyover_10s.mp4")
    scene.render.filepath = mp4_path
    if hasattr(scene.render.image_settings, "media_type"):
        scene.render.image_settings.media_type = 'VIDEO'
    else:
        scene.render.image_settings.file_format = 'FFMPEG'
    scene.render.ffmpeg.format = 'MPEG4'
    scene.render.ffmpeg.codec = 'H264'
    scene.render.ffmpeg.constant_rate_factor = 'HIGH'
    scene.render.ffmpeg.ffmpeg_preset = 'GOOD'
    scene.frame_set(FRAME_START)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(output_dir, "klcc_drone_flyover.blend"))


def main():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    parser = argparse.ArgumentParser(description="Generate and render 3D KLCC Drone Flyover")
    parser.add_argument("--preview", action="store_true", help="Render preview PNG frames (20, 120, 220)")
    parser.add_argument("--render-all", action="store_true", help="Render full 240-frame 10s MP4 animation")
    args = parser.parse_args(argv)

    output_dir = os.path.dirname(os.path.abspath(__file__))
    build_full_klcc_scene(output_dir)

    if args.preview:
        render_preview_frames(output_dir, frames=(20, 120, 220))
    if args.render_all:
        print("[KLCC] Rendering full 240-frame 10s MP4 animation...")
        bpy.ops.render.render(animation=True)
        print("[KLCC] Full animation render complete!")


if __name__ == "__main__":
    main()
