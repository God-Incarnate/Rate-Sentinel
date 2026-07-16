from pathlib import Path
from textwrap import wrap

PAGE_WIDTH = 595
PAGE_HEIGHT = 842
FONT_SIZE = 11
LEADING = 14
LEFT_MARGIN = 48
TOP_TEXT_Y = 790
TEXT_MAX_CHARS = 92


class PdfBuilder:
    def __init__(self):
        self.objects = [None]
        self.catalog_id = self._add_obj("")
        self.pages_id = self._add_obj("")
        self.font_id = self._add_obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
        self.page_ids = []

    def _add_obj(self, content: str) -> int:
        self.objects.append(content)
        return len(self.objects) - 1

    @staticmethod
    def _escape(text: str) -> str:
        return text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

    def add_text_page(self, lines):
        commands = ["BT", f"/F1 {FONT_SIZE} Tf", f"{LEFT_MARGIN} {TOP_TEXT_Y} Td", f"{LEADING} TL"]
        for raw in lines:
            line = raw.rstrip("\n")
            if not line.strip():
                commands.append("T*")
                continue
            for segment in wrap(line, width=TEXT_MAX_CHARS) or [""]:
                commands.append(f"({self._escape(segment)}) Tj")
                commands.append("T*")
        commands.append("ET")
        self._add_page_from_commands(commands)

    def add_shape_page(self, draw_commands):
        self._add_page_from_commands(draw_commands)

    def _add_page_from_commands(self, draw_commands):
        stream = "\n".join(draw_commands)
        length = len(stream.encode("latin-1", errors="replace"))
        content_id = self._add_obj(f"<< /Length {length} >>\nstream\n{stream}\nendstream")
        page_id = self._add_obj(
            f"<< /Type /Page /Parent {self.pages_id} 0 R "
            f"/MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
            f"/Resources << /Font << /F1 {self.font_id} 0 R >> >> "
            f"/Contents {content_id} 0 R >>"
        )
        self.page_ids.append(page_id)

    def save(self, output_path: Path):
        kids = " ".join([f"{pid} 0 R" for pid in self.page_ids])
        self.objects[self.pages_id] = f"<< /Type /Pages /Count {len(self.page_ids)} /Kids [{kids}] >>"
        self.objects[self.catalog_id] = f"<< /Type /Catalog /Pages {self.pages_id} 0 R >>"

        output = bytearray()
        output.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

        offsets = [0] * len(self.objects)
        for idx in range(1, len(self.objects)):
            offsets[idx] = len(output)
            output.extend(f"{idx} 0 obj\n{self.objects[idx]}\nendobj\n".encode("latin-1", errors="replace"))

        xref_start = len(output)
        output.extend(f"xref\n0 {len(self.objects)}\n".encode("ascii"))
        output.extend(b"0000000000 65535 f \n")
        for idx in range(1, len(self.objects)):
            output.extend(f"{offsets[idx]:010d} 00000 n \n".encode("ascii"))

        output.extend(
            (
                "trailer\n"
                f"<< /Size {len(self.objects)} /Root {self.catalog_id} 0 R >>\n"
                "startxref\n"
                f"{xref_start}\n"
                "%%EOF\n"
            ).encode("ascii")
        )

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_bytes(output)


def text_block(x, y, size, lines):
    cmds = ["BT", f"/F1 {size} Tf", f"{x} {y} Td", f"{LEADING} TL"]
    for line in lines:
        cmds.append(f"({PdfBuilder._escape(line)}) Tj")
        cmds.append("T*")
    cmds.append("ET")
    return cmds


def box(cmds, x, y, w, h, title, body_lines):
    cmds.append(f"{x} {y} {w} {h} re S")
    cmds.extend(text_block(x + 8, y + h - 18, 11, [title]))
    body_y = y + h - 36
    cmds.extend(text_block(x + 8, body_y, 9, body_lines))


def arrow(cmds, x1, y1, x2, y2):
    cmds.append(f"{x1} {y1} m {x2} {y2} l S")
    # tiny arrow head
    if x2 >= x1:
        cmds.append(f"{x2} {y2} m {x2 - 5} {y2 + 3} l S")
        cmds.append(f"{x2} {y2} m {x2 - 5} {y2 - 3} l S")
    else:
        cmds.append(f"{x2} {y2} m {x2 + 5} {y2 + 3} l S")
        cmds.append(f"{x2} {y2} m {x2 + 5} {y2 - 3} l S")


def build_hld_pdf(output_path: Path):
    doc = PdfBuilder()

    doc.add_text_page([
        "RATE-SENTINEL HLD WITH DIAGRAMS",
        "Version: 1.1",
        "Date: 2026-07-16",
        "",
        "This document adds visual architecture views for context, container, and key runtime sequence.",
        "The detailed written HLD remains available in docs/HLD.md.",
    ])

    # Context diagram page
    cmds = ["0.8 w"]
    cmds.extend(text_block(48, 804, 14, ["System Context Diagram"]))
    box(cmds, 220, 620, 160, 72, "Rate-Sentinel", ["API gateway", "Auth, rate limit, OTP,", "idempotent payment"])
    box(cmds, 48, 620, 140, 72, "Client Apps", ["Mobile app", "Web app", "Internal services"])
    box(cmds, 410, 620, 140, 72, "Admin", ["Rule management", "Ops monitoring"])
    box(cmds, 48, 500, 140, 72, "Redis", ["Counters", "cache", "lock keys"])
    box(cmds, 220, 500, 160, 72, "MySQL", ["Rules", "OTP records", "payments"])
    box(cmds, 410, 500, 140, 72, "Kafka", ["Notification", "payment events"])
    arrow(cmds, 188, 656, 220, 656)
    arrow(cmds, 410, 656, 380, 656)
    arrow(cmds, 300, 620, 300, 572)
    arrow(cmds, 252, 620, 120, 572)
    arrow(cmds, 348, 620, 480, 572)
    doc.add_shape_page(cmds)

    # Container diagram page
    cmds = ["0.8 w"]
    cmds.extend(text_block(48, 804, 14, ["Container / Component View"]))
    box(cmds, 48, 620, 160, 86, "Filters", ["JWTAuthFilter", "RateLimitFilter"])
    box(cmds, 230, 620, 160, 86, "Controllers", ["Auth, OTP, Payment", "AdminRule"])
    box(cmds, 412, 620, 140, 86, "Services", ["RateLimitService", "OTPService", "PaymentService"])
    box(cmds, 48, 500, 160, 86, "Algorithms", ["SlidingWindow", "TokenBucket", "FixedWindow"])
    box(cmds, 230, 500, 160, 86, "Repositories", ["RateLimitRuleRepo", "OTPRepo", "PaymentRepo"])
    box(cmds, 412, 500, 140, 86, "Infra", ["Redis", "MySQL", "Kafka"])
    arrow(cmds, 208, 664, 230, 664)
    arrow(cmds, 390, 664, 412, 664)
    arrow(cmds, 482, 620, 482, 586)
    arrow(cmds, 330, 620, 330, 586)
    arrow(cmds, 128, 620, 128, 586)
    arrow(cmds, 208, 543, 230, 543)
    arrow(cmds, 390, 543, 412, 543)
    doc.add_shape_page(cmds)

    # Sequence diagram page
    cmds = ["0.8 w"]
    cmds.extend(text_block(48, 804, 14, ["Rate Limit Runtime Sequence"]))
    cmds.extend(text_block(56, 760, 10, ["Client", "JWTFilter", "RateLimitFilter", "RateLimitService", "Algorithm", "Redis"]))

    x_positions = [70, 145, 240, 355, 460, 540]
    for x in x_positions:
        cmds.append(f"{x} 730 m {x} 420 l S")

    def msg(y, src, dst, label):
        arrow(cmds, x_positions[src], y, x_positions[dst], y)
        cmds.extend(text_block(min(x_positions[src], x_positions[dst]) + 6, y + 8, 8, [label]))

    msg(700, 0, 1, "Bearer token")
    msg(670, 1, 2, "clientId attribute")
    msg(640, 2, 3, "checkRateLimit(clientId, route)")
    msg(610, 3, 4, "resolve algorithm + key")
    msg(580, 4, 5, "atomic quota eval")
    msg(550, 5, 4, "allowed/remaining")
    msg(520, 4, 3, "decision")
    msg(490, 3, 2, "RateLimitResult")
    msg(460, 2, 0, "200 or 429 + X-RateLimit-*")
    doc.add_shape_page(cmds)

    doc.save(output_path)


def build_lld_pdf(output_path: Path):
    doc = PdfBuilder()

    doc.add_text_page([
        "RATE-SENTINEL LLD WITH DIAGRAMS",
        "Version: 1.1",
        "Date: 2026-07-16",
        "",
        "This document adds module-level design diagrams and key state transitions.",
        "The detailed written LLD remains available in docs/LLD.md.",
    ])

    # OTP component + sequence
    cmds = ["0.8 w"]
    cmds.extend(text_block(48, 804, 14, ["LLD-OTP Flow"]))
    box(cmds, 48, 620, 150, 72, "OTPController", ["Generate", "Verify"])
    box(cmds, 222, 620, 170, 72, "OTPService", ["SecureRandom", "BCrypt", "lockCheck"])
    box(cmds, 416, 620, 130, 72, "OTPRepository", ["OTPRecord", "JPA"])
    box(cmds, 48, 510, 150, 72, "Redis", ["otp:lock:{id}", "TTL lockout"])
    box(cmds, 222, 510, 170, 72, "NotificationDispatcher", ["build event", "dispatch async"])
    box(cmds, 416, 510, 130, 72, "Kafka", ["sms/email/", "whatsapp topic"])
    arrow(cmds, 198, 656, 222, 656)
    arrow(cmds, 392, 656, 416, 656)
    arrow(cmds, 307, 620, 307, 582)
    arrow(cmds, 481, 620, 481, 582)
    arrow(cmds, 222, 546, 198, 546)
    arrow(cmds, 392, 546, 416, 546)
    doc.add_shape_page(cmds)

    # Payment state + idempotency
    cmds = ["0.8 w"]
    cmds.extend(text_block(48, 804, 14, ["LLD-Payment Idempotency and State"]))
    box(cmds, 48, 630, 150, 70, "Input", ["Idempotency-Key", "amount, currency"])
    box(cmds, 222, 630, 160, 70, "Redis Check", ["payment:idem:{key}", "fast retry path"])
    box(cmds, 406, 630, 140, 70, "MySQL Check", ["existsByIdempotencyKey", "durable truth"])
    box(cmds, 48, 520, 150, 70, "PENDING", ["create + save"])
    box(cmds, 222, 520, 160, 70, "SUCCESS", ["processedAt set", "redis TTL write"])
    box(cmds, 406, 520, 140, 70, "FAILED", ["failureReason set", "save"])
    arrow(cmds, 198, 665, 222, 665)
    arrow(cmds, 382, 665, 406, 665)
    arrow(cmds, 476, 630, 123, 590)
    arrow(cmds, 123, 590, 123, 590)
    arrow(cmds, 123, 520, 302, 555)
    arrow(cmds, 123, 520, 476, 555)
    doc.add_shape_page(cmds)

    # Rule evaluation decision view
    cmds = ["0.8 w"]
    cmds.extend(text_block(48, 804, 14, ["LLD-Rule Evaluation Decision Tree"]))
    box(cmds, 228, 700, 140, 56, "Start", ["clientId + route"])
    box(cmds, 228, 620, 140, 56, "Exact Match?", ["clientId + route"])
    box(cmds, 60, 540, 140, 56, "Wildcard Client?", ["* + route"])
    box(cmds, 228, 540, 140, 56, "Pattern Match?", ["/api/** etc"])
    box(cmds, 396, 540, 140, 56, "Global Default?", ["* + *"])
    box(cmds, 228, 460, 140, 56, "Fallback Rule", ["properties default"])
    arrow(cmds, 298, 700, 298, 676)
    arrow(cmds, 298, 620, 130, 596)
    arrow(cmds, 298, 620, 298, 596)
    arrow(cmds, 298, 620, 466, 596)
    arrow(cmds, 130, 540, 298, 516)
    arrow(cmds, 298, 540, 298, 516)
    arrow(cmds, 466, 540, 298, 516)
    doc.add_shape_page(cmds)

    doc.save(output_path)


def main():
    repo_root = Path(__file__).resolve().parents[1]
    docs_dir = repo_root / "docs"

    build_hld_pdf(docs_dir / "HLD_with_diagrams.pdf")
    build_lld_pdf(docs_dir / "LLD_with_diagrams.pdf")

    print("Generated docs/HLD_with_diagrams.pdf and docs/LLD_with_diagrams.pdf")


if __name__ == "__main__":
    main()

