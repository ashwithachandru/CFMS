import sys
import os
import json
import re
import cv2
import unicodedata

def get_bbox_metrics(bbox):
    xs = [p[0] for p in bbox]
    ys = [p[1] for p in bbox]
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    width = x_max - x_min
    height = y_max - y_min
    cx = (x_min + x_max) / 2.0
    cy = (y_min + y_max) / 2.0
    return {
        'x_min': x_min, 'x_max': x_max,
        'y_min': y_min, 'y_max': y_max,
        'width': width, 'height': height,
        'cx': cx, 'cy': cy
    }

def preprocess_image_pass(image_path):
    try:
        import cv2
        img = cv2.imread(image_path)
        if img is None:
            return image_path, False

        h, w = img.shape[:2]
        if min(h, w) < 800:
            scale = 1000.0 / min(h, w)
            new_w, new_h = int(w * scale), int(h * scale)
            img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
            out_p = image_path + '.scale.jpg'
            cv2.imwrite(out_p, img)
            return out_p, True
    except Exception:
        pass
    return image_path, False

def levenshtein_dist(s1, s2):
    if len(s1) < len(s2):
        return levenshtein_dist(s2, s1)
    if len(s2) == 0:
        return len(s1)
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

def match_label_fuzzy(text, target_keywords):
    t_clean = re.sub(r'[^a-z0-9]', '', text.lower())
    if not t_clean:
        return False
    for tgt in target_keywords:
        tgt_clean = re.sub(r'[^a-z0-9]', '', tgt.lower())
        if tgt_clean in t_clean or t_clean in tgt_clean:
            return True
        if len(t_clean) >= 4 and abs(len(t_clean) - len(tgt_clean)) <= 2:
            if levenshtein_dist(t_clean, tgt_clean) <= 2:
                return True
    return False

def is_phone_number(candidate, text_context=''):
    if re.search(r'(?:customercare|care|help\s*line|toll\s*free|support|service|phone|mobile|mob|tel|ph|contact|fax|whatsapp|accounts)', candidate + ' ' + text_context, re.IGNORECASE):
        return True
    clean = re.sub(r'[\s\-\(\)\.]', '', candidate)
    if re.search(r'^\d{7,11}$', clean) and not re.search(r'[A-Z]', candidate, re.IGNORECASE):
        return True
    if re.search(r'^(?:0\d{3,4}|\+?91)', clean):
        return True
    return False

def is_gstin(candidate):
    if re.search(r'(?:gstin|gst)', candidate, re.IGNORECASE):
        return True
    return bool(re.search(r'\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]{3}\b', candidate, re.IGNORECASE))

def is_ifsc(candidate):
    return bool(re.search(r'\b[A-Z]{4}0[A-Z0-9]{6}\b', candidate, re.IGNORECASE))

def is_bank_account(candidate, text_context=''):
    clean = re.sub(r'[\s\-\.]', '', candidate)
    if is_ifsc(candidate):
        return True
    if re.search(r'(?:bank|a/c|account|ifsc|axis|hdfc|icici|sbi)', candidate + ' ' + text_context, re.IGNORECASE):
        return True
    if re.search(r'\b\d{11,18}\b', clean):
        return True
    return False

def is_date(candidate):
    if re.search(r'(?:date|dt:|\b\d{1,4}[-/\.]\d{1,2}[-/\.]\d{2,4}\b|\b\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}\b)', candidate, re.IGNORECASE):
        return True
    return False

def is_amount_or_qty(candidate):
    if re.search(r'(?:amount|rs\.|₹|total|grand|taxable|\b\d+[\.,]\d{2}\b)', candidate, re.IGNORECASE):
        return True
    return False

def is_customer_code(candidate, text_context=''):
    if re.search(r'(?:customer\s*code|cust\s*code|customer\s*id|party\s*code|caxner|csde|buyer\s*code)', candidate + ' ' + text_context, re.IGNORECASE):
        return True
    if re.search(r'\bC0?\d{4,6}\b', candidate, re.IGNORECASE):
        return True
    return False

def extract_value_from_combined_label(text):
    m = re.search(r'(?:invoice\s*no|invoice\s*number|invoice\s*#|inv\s*no|inv\s*#|bill\s*no|bill\s*#|tax\s*invoice|doc\s*no|ref\s*no)[\s:#\.-]*(.+)$', text, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    return text.strip()

def normalize_general_invoice_text(raw_val):
    val = extract_value_from_combined_label(raw_val)
    val = re.sub(r'^[:\-\s,]+|[:\-\s,%]+$', '', val)
    return val

def run_single_ocr_pass(img_p, engine):
    result, elapse = engine(img_p)
    if not result:
        return []
    ocr_boxes = []
    for line in result:
        bbox, text, conf = line
        text_str = text.strip()
        if not text_str:
            continue
        metrics = get_bbox_metrics(bbox)
        metrics['text'] = text_str
        metrics['conf'] = float(conf)
        ocr_boxes.append(metrics)
    return ocr_boxes

def extract_invoice_number_field(ocr_boxes):
    if not ocr_boxes:
        return ''

    label_keywords = ['invoiceno', 'invoicenumber', 'invoice', 'invno', 'inv', 'billno', 'billnumber', 'bill', 'taxinvoice', 'docno', 'refno']
    label_boxes = []
    for box in ocr_boxes:
        if match_label_fuzzy(box['text'], label_keywords):
            t_lower = box['text'].lower()
            if not any(ex in t_lower for ex in ['customer', 'care', 'total', 'grand', 'amount', 'date', 'bank', 'accounts', 'caxner', 'csde']):
                label_boxes.append(box)

    max_y = max(b['y_max'] for b in ocr_boxes)
    scored_candidates = []

    for candidate in ocr_boxes:
        raw_text = candidate['text']
        extracted_text = extract_value_from_combined_label(raw_text)
        conf = candidate['conf']
        cx = candidate['cx']
        cy = candidate['cy']

        if not re.search(r'\d', extracted_text):
            continue

        if is_date(extracted_text) or is_phone_number(extracted_text) or is_gstin(extracted_text) or is_ifsc(extracted_text) or is_bank_account(extracted_text) or is_amount_or_qty(extracted_text) or is_customer_code(extracted_text):
            continue

        if len(extracted_text) < 3:
            continue

        score = conf * 100.0

        if max_y > 0 and (cy / max_y) <= 0.40:
            score += 30.0

        has_proximity = False
        for lbl in label_boxes:
            horiz_dist = candidate['x_min'] - lbl['x_max']
            vert_diff = abs(cy - lbl['cy'])
            if 0 <= horiz_dist <= (lbl['height'] * 6.0) and vert_diff <= (lbl['height'] * 1.5):
                score += 50.0
                has_proximity = True
                break
            
            vert_dist = candidate['y_min'] - lbl['y_max']
            horiz_diff = abs(cx - lbl['cx'])
            if 0 <= vert_dist <= (lbl['height'] * 3.0) and horiz_diff <= (lbl['width'] * 2.0):
                score += 40.0
                has_proximity = True
                break

        has_letters = bool(re.search(r'[A-Z]', extracted_text, re.IGNORECASE))
        has_separators = bool(re.search(r'[\-_/&]', extracted_text))
        has_digits = bool(re.search(r'\d', extracted_text))

        if has_letters and has_digits and has_separators:
            score += 80.0
        elif (has_letters and has_digits) or (has_digits and has_separators):
            score += 50.0
        elif re.search(r'^(?:INV|BILL|REC|DOC|I)[-_/&]?[0-9]{3,10}', extracted_text, re.IGNORECASE):
            score += 40.0

        if not (has_letters and has_digits) and not has_proximity:
            score -= 60.0

        normalized_text = normalize_general_invoice_text(extracted_text)

        scored_candidates.append({
            'text': normalized_text,
            'score': score,
            'conf': conf,
            'has_structure': (has_letters and has_digits) or (has_digits and has_separators)
        })

    if not scored_candidates:
        return ''

    scored_candidates.sort(key=lambda item: item['score'], reverse=True)
    best = scored_candidates[0]

    if best['score'] >= 50.0 and best['conf'] >= 0.40 and best['has_structure']:
        return normalize_general_invoice_text(best['text'])

    return ''

def extract_labeled_field(ocr_boxes, keywords):
    for i, box in enumerate(ocr_boxes):
        if match_label_fuzzy(box['text'], keywords):
            # Check combined string (e.g.  Customer Code: C014479)
            parts = re.split(r'[:#-]', box['text'], maxsplit=1)
            if len(parts) > 1 and parts[1].strip():
                return parts[1].strip()
            # Check next adjacent box right or below
            for j in range(i + 1, min(i + 4, len(ocr_boxes))):
                nxt = ocr_boxes[j]
                horiz_dist = nxt['x_min'] - box['x_max']
                vert_diff = abs(nxt['cy'] - box['cy'])
                if 0 <= horiz_dist <= (box['height'] * 6.0) and vert_diff <= (box['height'] * 1.5):
                    return nxt['text'].strip()
                vert_dist = nxt['y_min'] - box['y_max']
                horiz_diff = abs(nxt['cx'] - box['cx'])
                if 0 <= vert_dist <= (box['height'] * 3.0) and horiz_diff <= (box['width'] * 2.0):
                    return nxt['text'].strip()
def reconstruct_visual_reading_order(boxes, img=None, engine=None):
    """
    Column-aware, table-aware and layout-reconstructed visual reading order.
    Preserves multi-column layout, label-value alignment, line-items table structure, and Quantity data.
    """
    if not boxes:
        return ""

    h_img, w_img = (img.shape[0], img.shape[1]) if img is not None else (1000, 1000)

    # 1. Check if there is a table header
    header_keywords = ['description', 'quantity', 'unit price', 'total', 'item', 'particulars', 'rate', 'amount', 'qty']
    header_candidates = [b for b in boxes if any(k == b['text'].lower() or k in b['text'].lower() for k in header_keywords) and b['cy'] < (h_img * 0.6)]
    
    header_line = None
    for hb in header_candidates:
        peers = [b for b in header_candidates if abs(b['cy'] - hb['cy']) <= 12.0]
        if len(peers) >= 3:
            header_line = sorted(peers, key=lambda b: b['x_min'])
            break

    def format_key_value_column(b_list):
        """Specifically formats a key-value block (e.g. Invoice Number/Date block or Bank block)."""
        min_x = min(b['x_min'] for b in b_list)
        max_x = max(b['x_max'] for b in b_list)
        mid_x = (min_x + max_x) / 2.0

        lbls = [b for b in b_list if b['x_max'] <= mid_x + 20]
        vals = [b for b in b_list if b['x_min'] >= mid_x - 20]

        if lbls and vals and (len(lbls) + len(vals)) == len(b_list):
            vals_sorted = sorted(vals, key=lambda x: x['y_min'])
            v_groups = {i: [] for i in range(len(vals_sorted))}
            for l in lbls:
                best_vi = min(range(len(vals_sorted)), key=lambda vi: abs(l['cy'] - vals_sorted[vi]['cy']))
                v_groups[best_vi].append(l)

            rows = []
            for i, v in enumerate(vals_sorted):
                row_lbls = v_groups[i]
                row_lbls_sorted = sorted(row_lbls, key=lambda l: (l['y_min'], l['x_min']))
                lbl_text = ' '.join(l['text'] for l in row_lbls_sorted)
                # Standardize date spacing e.g. December24,2028 -> December 24, 2028
                v_text = re.sub(r'([A-Za-z]+)(\d{1,2}),(\d{4})', r'\1 \2, \3', v['text'])
                if lbl_text:
                    rows.append(f"{lbl_text} : {v_text}")
                else:
                    rows.append(v_text)
            return rows

        return format_standard_lines(b_list)

    def format_standard_lines(b_list):
        """Standard line grouping: groups boxes into horizontal lines by center-y overlap."""
        sorted_sub = sorted(b_list, key=lambda b: b['cy'])
        text_lines = []
        for b in sorted_sub:
            placed = False
            for line in text_lines:
                l_cy = sum(x['cy'] for x in line) / len(line)
                l_h = max(x['height'] for x in line)
                if abs(b['cy'] - l_cy) <= max(6.0, l_h * 0.45):
                    line.append(b)
                    placed = True
                    break
            if not placed:
                text_lines.append([b])

        res = []
        for line in text_lines:
            line_sorted = sorted(line, key=lambda b: b['x_min'])
            res.append(line_sorted)
        res.sort(key=lambda l: min(b['y_min'] for b in l))

        output_strings = []
        for line in res:
            output_strings.append('  '.join(b['text'] for b in line))
        return output_strings

    def process_sub_bands(sub_boxes):
        if not sub_boxes:
            return []
        boxes_sorted = sorted(sub_boxes, key=lambda b: (b['y_min'], b['x_min']))
        bands = []
        curr_band = [boxes_sorted[0]]
        curr_max_y = boxes_sorted[0]['y_max']

        for b in boxes_sorted[1:]:
            if b['y_min'] - curr_max_y >= 9.0:
                bands.append(curr_band)
                curr_band = [b]
                curr_max_y = b['y_max']
            else:
                curr_band.append(b)
                curr_max_y = max(curr_max_y, b['y_max'])
        if curr_band:
            bands.append(curr_band)

        out_lines = []
        for band in bands:
            band_x_min = min(b['x_min'] for b in band)
            band_x_max = max(b['x_max'] for b in band)
            span = int(band_x_max - band_x_min) + 1
            coverage = [0] * span
            for b in band:
                for i in range(max(0, int(b['x_min'] - band_x_min)), min(span, int(b['x_max'] - band_x_min))):
                    coverage[i] += 1

            gutters = []
            g_start = None
            for i in range(span):
                if coverage[i] == 0:
                    if g_start is None: g_start = i
                else:
                    if g_start is not None:
                        if (i - g_start) >= 25:
                            gutters.append((g_start + band_x_min, i + band_x_min))
                        g_start = None
            if g_start is not None and (span - g_start) >= 25:
                gutters.append((g_start + band_x_min, span + band_x_min))

            if gutters:
                gutters.sort(key=lambda g: g[1] - g[0], reverse=True)
                split_x = (gutters[0][0] + gutters[0][1]) / 2.0
                left_col = [b for b in band if b['x_max'] <= split_x]
                right_col = [b for b in band if b['x_min'] >= split_x]
                middle = [b for b in band if b['x_min'] < split_x < b['x_max']]

                if left_col and right_col and not middle:
                    if any(k in ' '.join(b['text'].lower() for b in left_col) for k in ['bank name', 'account name']):
                        out_lines.extend(format_key_value_column(left_col))
                    else:
                        out_lines.extend(format_standard_lines(left_col))

                    if any(k in ' '.join(b['text'].lower() for b in right_col) for k in ['invoice', 'number', 'date']):
                        out_lines.extend(format_key_value_column(right_col))
                    else:
                        out_lines.extend(format_standard_lines(right_col))
                    continue

            out_lines.extend(format_standard_lines(band))
        return out_lines

    # If no multi-column table header detected, return standard visual reading order
    if not header_line:
        return '\n'.join(process_sub_bands(boxes))

    # --- TABLE SECTION PROCESSING ---
    table_top_y = min(b['y_min'] for b in header_line)
    header_bottom_y = max(b['y_max'] for b in header_line)

    footer_keywords = ['total amount', 'totalamount', 'subtotal', 'sub total', 'payment information', 'bank name', 'notes', 'terms']
    footer_candidates = [b for b in boxes if b['y_min'] >= header_bottom_y and any(k in b['text'].lower() for k in footer_keywords)]
    table_bottom_y = min(b['y_min'] for b in footer_candidates) if footer_candidates else (h_img * 0.75)

    # 1. Header block (above table)
    top_boxes = [b for b in boxes if b['y_max'] <= table_top_y]
    final_output = process_sub_bands(top_boxes)

    # 2. Table Header line
    final_output.append('  |  '.join(b['text'] for b in header_line))

    # 3. Table Rows
    qty_header = next((b for b in header_line if 'quantity' in b['text'].lower() or 'qty' in b['text'].lower()), None)
    table_body_boxes = [b for b in boxes if header_bottom_y <= b['cy'] < table_bottom_y]

    row_anchors = [b for b in table_body_boxes if ('$' in b['text'] or re.search(r'\d+\.\d{2}', b['text'])) and b['cx'] > w_img * 0.4]
    row_anchor_groups = []
    for b in sorted(row_anchors, key=lambda x: x['cy']):
        placed = False
        for g in row_anchor_groups:
            if abs(b['cy'] - (sum(x['cy'] for x in g) / len(g))) <= 10.0:
                g.append(b)
                placed = True
                break
        if not placed:
            row_anchor_groups.append([b])

    for i, g in enumerate(row_anchor_groups):
        row_cy = sum(b['cy'] for b in g) / len(g)
        row_y_min = min(b['y_min'] for b in g) - 6
        row_y_max = max(b['y_max'] for b in g) + 6

        row_boxes = [b for b in table_body_boxes if abs(b['cy'] - row_cy) <= 12.0 or (row_y_min <= b['cy'] <= row_y_max)]

        qty_str = None
        if qty_header:
            for b in row_boxes:
                if abs(b['cx'] - qty_header['cx']) <= 18 and re.search(r'\d+', b['text']):
                    qty_str = re.search(r'\d+', b['text']).group(0)
                    break
            if not qty_str and img is not None and engine is not None and hasattr(engine, 'text_recognizer'):
                y1 = max(0, int(row_cy - 8))
                y2 = min(h_img, int(row_cy + 8))
                x1 = max(0, int(qty_header['cx'] - 10))
                x2 = min(w_img, int(qty_header['cx'] + 10))
                cell_crop = img[y1:y2, x1:x2]
                rec_res, _ = engine.text_recognizer([cell_crop])
                if rec_res and rec_res[0] and rec_res[0][0]:
                    norm = unicodedata.normalize('NFKC', rec_res[0][0]).strip()
                    if re.search(r'\d+', norm):
                        qty_str = re.search(r'\d+', norm).group(0)

        desc_parts = [b for b in row_boxes if b['cx'] < (qty_header['x_min'] if qty_header else w_img * 0.4)]
        desc_parts.sort(key=lambda b: (b['y_min'], b['x_min']))
        desc_text = ' '.join(b['text'] for b in desc_parts)

        next_row_cy = row_anchor_groups[i + 1][0]['cy'] if i + 1 < len(row_anchor_groups) else table_bottom_y
        desc_sub = [b for b in table_body_boxes if b['cx'] < w_img * 0.4 and (row_cy + 10) < b['cy'] < (next_row_cy - 8)]
        if desc_sub:
            desc_sub.sort(key=lambda b: b['x_min'])
            desc_text += ' ' + ' '.join(b['text'] for b in desc_sub)

        right_numbers = [b for b in row_boxes if b['cx'] >= (qty_header['x_max'] if qty_header else w_img * 0.4)]
        right_numbers.sort(key=lambda b: b['x_min'])
        unit_price = right_numbers[0]['text'] if len(right_numbers) >= 1 else ''
        total_price = right_numbers[1]['text'] if len(right_numbers) >= 2 else ''

        final_output.append(f"{desc_text}  |  {qty_str or '-'}  |  {unit_price}  |  {total_price}")

    # 4. Bottom block (below table)
    bottom_boxes = [b for b in boxes if b['y_min'] >= table_bottom_y]
    final_output.extend(process_sub_bands(bottom_boxes))

    return '\n'.join(final_output)

def extract_full_invoice_structure(ocr_boxes, img=None, engine=None):
    raw_text_full = reconstruct_visual_reading_order(ocr_boxes, img=img, engine=engine)
    raw_lines = [l for l in raw_text_full.split('\n') if l.strip()]

    inv_num = extract_invoice_number_field(ocr_boxes)
    cust_code = extract_labeled_field(ocr_boxes, ['Customer Code', 'Customer ID', 'Cust Code', 'Customer No', 'Party Code', 'Account Code'])
    if not cust_code:
        m_cust = re.search(r'\bC\d{5,7}\b', raw_text_full)
        if m_cust:
            cust_code = m_cust.group(0)

    warehouse = extract_labeled_field(ocr_boxes, ['Warehouse', 'Unit', 'Branch', 'Location', 'Store', 'Outlet', 'Dispatch Unit', 'Delivery Unit'])

    # Date extraction (prefer explicit date format first)
    inv_date = ''
    for line in raw_lines:
        m_d = re.search(r'\b(\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4})\b', line)
        if m_d:
            inv_date = m_d.group(1)
            break
    if not inv_date:
        inv_date = extract_labeled_field(ocr_boxes, ['Date', 'Invoice Date', 'Bill Date', 'Dated', 'Doc Date'])

    # Customer Name / Company Name
    cust_name = extract_labeled_field(ocr_boxes, ['Customer Name', 'Buyer', 'Bill To', 'M/s', 'Party Name', 'Customer'])
    if not cust_name:
        for line in raw_lines[:12]:
            if re.search(r'\b(?:handlooms|textiles|pvt|ltd|limited|cotton|mills|industries|enterprises|traders|store|agency)\b', line, re.IGNORECASE):
                cust_name = line.strip()
                break
        if not cust_name and len(raw_lines) > 0:
            cust_name = raw_lines[0].strip()

    # GSTIN
    gstin = ''
    m_gst = re.search(r'\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]{3}\b', raw_text_full)
    if m_gst:
        gstin = m_gst.group(0)
    else:
        for i, line in enumerate(raw_lines):
            if re.search(r'\b(?:gstin|gstnt|gstn|gsin)\b', line, re.IGNORECASE):
                m_g = re.search(r'\b([0-9]{2}[A-Z0-9]{8,13})\b', line)
                if m_g: gstin = m_g.group(1); break
                if i + 1 < len(raw_lines):
                    m_g2 = re.search(r'\b([0-9]{2}[A-Z0-9]{8,13})\b', raw_lines[i+1])
                    if m_g2: gstin = m_g2.group(1); break

    # Phone
    phone = ''
    m_ph = re.search(r'(?:\+?91[\-\s]*)?([6-9]\d{4}[\-\s]*\d{5})', raw_text_full)
    if m_ph:
        phone = m_ph.group(0).strip()
    else:
        m_care = re.search(r'(?:care|support|phone|tel)[:\s]*([0-9\+]{8,15})', raw_text_full, re.IGNORECASE)
        if m_care: phone = m_care.group(1).strip()

    order_num = extract_labeled_field(ocr_boxes, ['Order No', 'Order Number', 'P.O. No', 'PO No'])
    ref_num = extract_labeled_field(ocr_boxes, ['Ref No', 'Reference No', 'Doc No'])

    # Totals parsing
    grand_total = ''
    for i, line in enumerate(raw_lines):
        if re.search(r'\b(?:grand\s*total|net\s*total|invoice\s*total)\b', line, re.IGNORECASE):
            m_amt = re.search(r'([0-9]{1,3}(?:[,\.][0-9]{2,3})*(?:[,\.][0-9]{2}))', line)
            if m_amt: grand_total = m_amt.group(1).replace(',', '.'); break
            if i + 1 < len(raw_lines):
                m_amt2 = re.search(r'([0-9]{1,3}(?:[,\.][0-9]{2,3})*(?:[,\.][0-9]{2}))', raw_lines[i+1])
                if m_amt2: grand_total = m_amt2.group(1).replace(',', '.'); break

    subtotal = ''
    for i, line in enumerate(raw_lines):
        if re.search(r'\b(?:gross\s*tot(?:al)?|sub\s*total|taxable\s*value)\b', line, re.IGNORECASE):
            m_amt = re.search(r'([0-9]{1,3}(?:[,\.][0-9]{2,3})*(?:[,\.][0-9]{2}))', line)
            if m_amt: subtotal = m_amt.group(1).replace(',', '.'); break
            if i + 1 < len(raw_lines):
                m_amt2 = re.search(r'([0-9]{1,3}(?:[,\.][0-9]{2,3})*(?:[,\.][0-9]{2}))', raw_lines[i+1])
                if m_amt2: subtotal = m_amt2.group(1).replace(',', '.'); break

    cgst = ''
    sgst = ''
    igst = ''
    for i, line in enumerate(raw_lines):
        if re.search(r'\bCGST\b', line, re.IGNORECASE):
            m_tax = re.search(r'([0-9]+[,\.][0-9]{2})', line)
            if m_tax: cgst = m_tax.group(1).replace(',', '.')
            elif i+1 < len(raw_lines):
                m_next = re.search(r'([0-9]+[,\.][0-9]{2})', raw_lines[i+1])
                if m_next: cgst = m_next.group(1).replace(',', '.')
        if re.search(r'\bSGST\b', line, re.IGNORECASE):
            m_tax = re.search(r'([0-9]+[,\.][0-9]{2})', line)
            if m_tax: sgst = m_tax.group(1).replace(',', '.')
            elif i+1 < len(raw_lines):
                m_next = re.search(r'([0-9]+[,\.][0-9]{2})', raw_lines[i+1])
                if m_next: sgst = m_next.group(1).replace(',', '.')
        if re.search(r'\bIGST\b', line, re.IGNORECASE):
            m_tax = re.search(r'([0-9]+[,\.][0-9]{2})', line)
            if m_tax: igst = m_tax.group(1).replace(',', '.')

    # Products parsing (line items)
    products = []
    table_started = False
    for i, line in enumerate(raw_lines):
        if re.search(r'\b(?:desorpton|description|item|product|hsn)\b', line, re.IGNORECASE):
            table_started = True
            continue
        if re.search(r'\b(?:total|gross|subtotal|grand|cgst|sgst|taxable)\b', line, re.IGNORECASE):
            table_started = False
        if table_started:
            if len(line) >= 4 and not re.match(r'^[0-9\.,\s\-_:]+$', line):
                hsn_m = re.search(r'\b(\d{4,8})\b', line)
                hsn_val = hsn_m.group(1) if hsn_m else ''
                desc = re.sub(r'\b\d{4,8}\b', '', line).strip()
                amt = ''
                for j in range(i+1, min(i+3, len(raw_lines))):
                    am = re.search(r'\b([0-9]+(?:\.[0-9]{2}))\b', raw_lines[j])
                    if am:
                        amt = am.group(1)
                        break
                if desc and not re.search(r'\b(?:rate|value|qty|hsn|unit)\b', desc, re.IGNORECASE):
                    products.append({
                        'description': desc,
                        'product_code': '',
                        'hsn': hsn_val,
                        'quantity': '1',
                        'unit': 'PCS',
                        'rate': amt,
                        'discount': '0.00',
                        'tax': '5%',
                        'amount': amt
                    })

    # Other fields
    other_fields = {}
    m_pan = re.search(r'\b(PAN[A-Z0-9]{8,12})\b', raw_text_full, re.IGNORECASE)
    if m_pan: other_fields['pan'] = m_pan.group(1)

    m_ifsc = re.search(r'\b([A-Z]{4}0[A-Z0-9]{6})\b', raw_text_full)
    if m_ifsc: other_fields['bank_ifsc'] = m_ifsc.group(1)

    m_acc = re.search(r'\b(?:a/c|aic|account)\s*(?:no\.?)?[:\s]*([0-9]{9,18})\b', raw_text_full, re.IGNORECASE)
    if m_acc: other_fields['bank_account_number'] = m_acc.group(1)

    m_bank = re.search(r'([A-Za-z]+)\s*(?:bank|benk)', raw_text_full, re.IGNORECASE)
    if m_bank: other_fields['bank_name'] = m_bank.group(0).strip()

    m_round = re.search(r'Round(?:id)?\s*OF[:\s]*([0-9\.]+)', raw_text_full, re.IGNORECASE)
    if m_round: other_fields['round_off'] = m_round.group(1)

    return {
        'raw_text': raw_text_full,
        'fields': {
            'warehouse_unit': warehouse,
            'customer_code': cust_code,
            'invoice_number': inv_num,
            'invoice_date': inv_date,
            'customer_name': cust_name,
            'customer_address': '',
            'gstin': gstin,
            'phone': phone,
            'email': '',
            'billing_address': '',
            'shipping_address': '',
            'order_number': order_num,
            'reference_number': ref_num,
            'products': products,
            'totals': {
                'subtotal': subtotal,
                'cgst': cgst,
                'sgst': sgst,
                'igst': igst,
                'grand_total': grand_total
            },
            'other_fields': other_fields
        }
    }

def process_invoice_ocr(image_path, debug=False):
    if not os.path.exists(image_path):
        return {
            'success': False,
            'data': {'raw_text': '', 'fields': {}},
            'message': 'File not found'
        }

    try:
        from rapidocr_onnxruntime import RapidOCR
        engine = RapidOCR()
    except Exception as e:
        return {
            'success': False,
            'data': {'raw_text': '', 'fields': {}},
            'message': str(e)
        }

    pdf_tmp_path = None
    target_img_path = image_path

    if image_path.lower().endswith('.pdf'):
        try:
            import fitz
            doc = fitz.open(image_path)
            if len(doc) > 0:
                page = doc[0]
                pix = page.get_pixmap(dpi=150)
                pdf_tmp_path = image_path + '.pdf_page0.png'
                pix.save(pdf_tmp_path)
                target_img_path = pdf_tmp_path
        except Exception:
            pass

    ocr_boxes = run_single_ocr_pass(target_img_path, engine)

    scaled_p, created_tmp = preprocess_image_pass(target_img_path)
    if created_tmp and os.path.exists(scaled_p):
        if not ocr_boxes:
            ocr_boxes = run_single_ocr_pass(scaled_p, engine)
        try:
            os.remove(scaled_p)
        except Exception:
            pass

    if pdf_tmp_path and os.path.exists(pdf_tmp_path):
        try:
            os.remove(pdf_tmp_path)
        except Exception:
            pass

    if not ocr_boxes:
        return {
            'success': False,
            'data': {'raw_text': '', 'fields': {}},
            'message': 'No text detected'
        }

    img_np = None
    try:
        if os.path.exists(target_img_path):
            img_np = cv2.imread(target_img_path)
    except Exception:
        pass

    structured_data = extract_full_invoice_structure(ocr_boxes, img=img_np, engine=engine)
    # Also maintain legacy invoice_number top-level compatibility for existing callers
    structured_data['invoice_number'] = structured_data['fields']['invoice_number']

    return {
        'success': True,
        'data': structured_data
    }

if __name__ == '__main__':
    if len(sys.argv) > 1:
        img_p = sys.argv[1]
        is_dbg = '--debug' in sys.argv
        res = process_invoice_ocr(img_p, debug=is_dbg)
        print(json.dumps(res))
    else:
        print(json.dumps({'success': False, 'data': {'raw_text': '', 'fields': {}}}))