#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""OpenSPH .po -> .mo 编译器（纯 Python，GNU gettext 二进制格式，无系统 msgfmt）"""

import struct, sys, os, re

def parse_po(path):
    """解析 .po，返回 [(msgid, msgstr)]（保留未翻译条目，msgstr 可为空）。"""
    data = open(path, encoding="utf-8").read()
    entries = []
    # 逐条目解析
    # 简单状态机：找 msgid/msgstr
    lines = data.split("\n")
    i = 0
    cur_id = None
    cur_str = None
    def unquote(s):
        # 处理 "..."
        s = s.strip()
        if s.startswith('"') and s.endswith('"'):
            s = s[1:-1]
        # 转义解码（\n \t \" \\）
        out = []
        k = 0
        while k < len(s):
            c = s[k]
            if c == "\\" and k + 1 < len(s):
                n = s[k+1]
                mp = {"n": "\n", "t": "\t", '"': '"', "\\": "\\", "r": "\r"}
                out.append(mp.get(n, n))
                k += 2
            else:
                out.append(c)
                k += 1
        return "".join(out)
    for line in lines:
        ls = line.strip()
        if ls.startswith("msgid "):
            if cur_id is not None:
                entries.append((cur_id, cur_str))
            cur_id = unquote(ls[6:])
            cur_str = ""
        elif ls.startswith("msgstr "):
            cur_str = unquote(ls[7:])
        elif ls.startswith('"') and cur_id is not None and cur_str == "" and not cur_id:
            # header continuation
            pass
        elif ls.startswith('"') and cur_str is not None:
            # 续行
            pass
    if cur_id is not None:
        entries.append((cur_id, cur_str))
    return entries

def compile_mo(entries, out_path):
    """把 (msgid, msgstr) 列表编译成 .mo。只包含已翻译条目；未翻译的跳过（保持英文）。"""
    # 过滤：跳过空 msgstr（未翻译）
    items = [(mid.encode("utf-8"), ms.encode("utf-8")) for mid, ms in entries if ms]
    # 按 msgid 排序（稳定、可复现）
    items.sort(key=lambda x: x[0])
    N = len(items)
    MAGIC = 0x950412DE
    REV = 0
    # GNU .mo 布局：
    # [0:28] header（7 × uint32: magic, version, N, ofsOrig, ofsTrans, ofsHash, hashSize）
    # [28:28+8N] originals table（每条 entry: nLen, nOffset）
    # [28+8N:28+16N] translations table
    # 字符串数据区（每个字符串以 NUL 结尾；wxWidgets 依赖 NUL 截断读取）
    o_table_off = 28
    t_table_off = o_table_off + 8 * N
    str_off = t_table_off + 8 * N

    orig_data = b"".join(mid + b"\0" for mid, _ in items)
    trans_data = b"".join(ms + b"\0" for _, ms in items)

    # 计算每个字符串的 offset（相对文件头）
    o_off = []
    acc = 0
    for mid, _ in items:
        o_off.append(acc)
        acc += len(mid) + 1
    t_off = []
    acc = 0
    for _, ms in items:
        t_off.append(acc)
        acc += len(ms) + 1
    o_off = [str_off + x for x in o_off]
    t_off = [str_off + len(orig_data) + x for x in t_off]

    out = bytearray()
    out += struct.pack("<IIIIIII", MAGIC, REV, N, o_table_off, t_table_off, 0, 0)  # 28 字节；无哈希
    for i in range(N):
        out += struct.pack("<II", len(items[i][0]), o_off[i])
    for i in range(N):
        out += struct.pack("<II", len(items[i][1]), t_off[i])
    out += orig_data
    out += trans_data
    open(out_path, "wb").write(bytes(out))
    return N

if __name__ == "__main__":
    po = sys.argv[1] if len(sys.argv) > 1 else "OpenSPH.zh_CN.po"
    mo = sys.argv[2] if len(sys.argv) > 2 else po.replace(".po", ".mo")
    entries = parse_po(po)
    n = compile_mo(entries, mo)
    print(f"{po} -> {mo}: {n} 条已翻译条目已编译")
