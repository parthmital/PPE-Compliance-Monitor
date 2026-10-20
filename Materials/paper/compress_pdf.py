"""Shrink the compiled paper by re-encoding its embedded raster figures.

The plots in Backend/output/plots/ are high-resolution RGBA PNGs, which
xdvipdfmx embeds losslessly, so main.pdf grows to about 9 MB. This script
rewrites each image in the PDF, leaving the source plots untouched:

- flattens transparency onto white and caps the longer side at --max-px;
- stores plots (few distinct colours) as 256-colour indexed images with
  Flate compression, which keeps lines and text sharp;
- stores photographs (many distinct colours) as JPEG.

Usage (from Materials/paper, with the repository .venv):
    ..\\..\\.venv\\Scripts\\python compress_pdf.py main.pdf main.pdf
Requires pypdf and Pillow.
"""

import argparse
import io
import zlib
from pathlib import Path

from PIL import Image
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject,
    ByteStringObject,
    NameObject,
    NumberObject,
)

PHOTO_COLOURS = 50_000  # more distinct colours than this means a photograph


def flatten(image: Image.Image) -> Image.Image:
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        background = Image.new("RGB", image.size, "white")
        background.paste(image, mask=image.getchannel("A"))
        return background
    return image.convert("RGB")


def recompress(xobject, image: Image.Image, max_px: int, quality: int) -> None:
    image = flatten(image)
    image.thumbnail((max_px, max_px), Image.LANCZOS)
    colours = image.getcolors(PHOTO_COLOURS)

    for key in ("/SMask", "/DecodeParms", "/Decode", "/Mask"):
        if key in xobject:
            del xobject[key]
    xobject[NameObject("/Width")] = NumberObject(image.width)
    xobject[NameObject("/Height")] = NumberObject(image.height)
    xobject[NameObject("/BitsPerComponent")] = NumberObject(8)

    if colours is None:
        buffer = io.BytesIO()
        image.save(buffer, "JPEG", quality=quality, optimize=True)
        xobject[NameObject("/Filter")] = NameObject("/DCTDecode")
        xobject[NameObject("/ColorSpace")] = NameObject("/DeviceRGB")
        xobject._data = (
            buffer.getvalue()
        )  # already encoded; set_data only handles Flate
        return

    indexed = image.quantize(colors=256, method=Image.Quantize.MEDIANCUT)
    palette = indexed.getpalette()[: 3 * len(indexed.getcolors())]
    palette += [0] * (3 * 256 - len(palette))
    xobject[NameObject("/ColorSpace")] = ArrayObject(
        [
            NameObject("/Indexed"),
            NameObject("/DeviceRGB"),
            NumberObject(255),
            ByteStringObject(bytes(palette)),
        ]
    )
    xobject[NameObject("/Filter")] = NameObject("/FlateDecode")
    xobject._data = zlib.compress(indexed.tobytes(), 9)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("source", type=Path)
    parser.add_argument("target", type=Path)
    parser.add_argument("--max-px", type=int, default=1800)
    parser.add_argument("--quality", type=int, default=85, help="JPEG quality")
    args = parser.parse_args()

    writer = PdfWriter(clone_from=PdfReader(args.source))
    done = set()
    for page in writer.pages:
        for image_file in page.images:
            xobject = image_file.indirect_reference.get_object()
            if image_file.indirect_reference.idnum in done:
                continue
            done.add(image_file.indirect_reference.idnum)
            recompress(xobject, image_file.image, args.max_px, args.quality)

    writer.compress_identical_objects(remove_duplicates=True, remove_unreferenced=True)
    buffer = io.BytesIO()
    writer.write(buffer)
    args.target.write_bytes(buffer.getvalue())
    print(f"{args.target}: {len(buffer.getvalue()) / 1e6:.2f} MB, {len(done)} images")


if __name__ == "__main__":
    main()
