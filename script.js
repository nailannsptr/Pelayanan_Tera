(function () {
    'use strict';

    // ============================================
    // KONSTANTA & KONFIGURASI
    // ============================================
    // Konstanta perhitungan AT (Alat Timbangan)
    // AT Meja = Timbangan Meja × 5 (standar metrologi)
    // AT Neraca = Timbangan Neraca × 19 (standar metrologi)
    const K = {
        AT_MEJA: 5,
        AT_NERACA: 19
    };

    // SEL (Selectors) - Kumpulan ID elemen HTML untuk memudahkan maintenance
    // Mengelompokkan selector berdasarkan section: Pasar, Dinas, Hasil, Footer
    const SEL = {
        inputTahun: '#inputTahun',
        // Pasar (Pelayanan Tera Ulang di Pasar Tradisional)
        btnTambahPasar: '#btnTambahPasar',
        tbodyPasar: '#tbodyPasar',
        // Dinas (Target Kinerja/Ketentuan Dinas)
        btnTambahDinas: '#btnTambahDinas',
        tbodyDinas: '#tbodyDinas',
        // Hasil (Perbandingan Pelayanan vs Target)
        tbodyHasil: '#tbodyHasil',
        // Footer Pasar - Total per kolom untuk tabel Pelayanan
        totalTM: '#totalTM',
        totalTP: '#totalTP',
        totalTS: '#totalTS',
        totalTE: '#totalTE',
        totalTN: '#totalTN',
        atMejaPasar: '#atMejaPasar',
        atNeracaPasarTotal: '#atNeracaPasarTotal',
        jumlahPasar: '#jumlahPasar',
        capaianPasar: '#capaianPasar',
        // Footer Dinas - Total per kolom untuk tabel Target
        dinasTM: '#dinasTM',
        dinasTP: '#dinasTP',
        dinasTS: '#dinasTS',
        dinasTE: '#dinasTE',
        dinasTN: '#dinasTN',
        dinasATMeja: '#dinasATMeja',
        dinasATNeraca: '#dinasATNeraca',
        dinasJumlah: '#dinasJumlah',
        // Footer Hasil - Total keseluruhan
        hasilPasarTotal: '#hasilPasarTotal',
        hasilDinasTotal: '#hasilDinasTotal',
        persentaseTotal: '#persentaseTotal'
    };

    // ============================================
    // UTILITAS (Utility Functions)
    // ============================================
    // Objekt U berisi fungsi-fungsi helper yang digunakan di seluruh aplikasi
    const U = {
        // Shortcut untuk document.querySelector - cari 1 elemen
        $(s, p = document) { return p.querySelector(s); },
        // Shortcut untuk document.querySelectorAll - cari banyak elemen
        $$(s, p = document) { return p.querySelectorAll(s); },
        // Konversi ke number aman: handle NaN, negatif jadi 0
        num(v) { const n = Number(v); return isNaN(n) ? 0 : Math.max(0, n); },
        // Format angka ke format Indonesia (misal: 1000 -> "1.000")
        fmt(n) { return new Intl.NumberFormat('id-ID').format(n); },
        // Escape HTML untuk mencegah XSS (Cross-Site Scripting)
        escape(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; },
        // Factory function untuk membuat element HTML secara programatik
        // tag: nama tag (div, tr, td, dll)
        // attrs: object atribut {class, id, dataset, onclick, dll}
        // html: innerHTML string
        create(tag, attrs = {}, html = '') { 
            const el = document.createElement(tag); 
            Object.entries(attrs).forEach(([k, v]) => {
                if (k === 'class') el.className = v;
                else if (k === 'dataset' && typeof v === 'object') Object.entries(v).forEach(([dk, dv]) => el.dataset[dk] = dv);
                else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
                else el.setAttribute(k, v);
            }); 
            el.innerHTML = html; 
            return el; 
        },
        // Dapatkan class warna capaian berdasarkan persentase
        // < 50% = merah, < 79% = kuning, >= 80% = hijau
        getCapaianClass(pct) {
            if (pct < 50) return 'capaian-merah';
            if (pct < 79) return 'capaian-kuning';
            return 'capaian-hijau';
        }
    };

    // ============================================
    // MODEL DATA (State Management)
    // ============================================
    // State menyimpan semua data aplikasi dalam memori (single source of truth)
    // Mengikuti pola: data terpisah dari UI, UI hanya membaca dari State
    const State = {
        pelayanan: [],    // Array data pelayanan tera di pasar
        target: [],       // Array data target/ketentuan dinas
        tahun: 2025,      // Tahun pelaporan (dari input user)
        pasarId: 0,       // Auto-increment ID untuk pelayanan
        targetId: 0,      // Auto-increment ID untuk target

        // Menambah baris pelayanan baru (Pasar)
        addPelayanan(nama = '', alamat = '') {
            const id = ++this.pasarId;
            // Structure data pelayanan: semua field numerik default 0
            const row = { id, nama, alamat, tm: 0, tp: 0, ts: 0, te: 0, tn: 0, atMeja: 0, atNeraca: 0, jumlah: 0, capaian: 0 };
            this.pelayanan.push(row);
            return row;
        },

        // Menambah baris target baru (Ketentuan Dinas)
        addTarget(nama = '') {
            const id = ++this.targetId;
            // Structure data target: mirip pelayanan tapi tanpa alamat & capaian
            const row = { id, nama, tm: 0, tp: 0, ts: 0, te: 0, tn: 0, atMeja: 0, atNeraca: 0, jumlah: 0 };
            this.target.push(row);
            return row;
        },

        // Hapus pelayanan berdasarkan ID (filter array)
        removePelayanan(id) { this.pelayanan = this.pelayanan.filter(r => r.id !== id); },
        // Hapus target berdasarkan ID
        removeTarget(id) { this.target = this.target.filter(r => r.id !== id); },

        // Update field spesifik pelayanan (digunakan saat user edit input)
        updatePelayanan(id, field, value) {
            const row = this.pelayanan.find(r => r.id === id);
            if (row) row[field] = value;
        },

        // Update field spesifik target
        updateTarget(id, field, value) {
            const row = this.target.find(r => r.id === id);
            if (row) row[field] = value;
        }
    };

    // ============================================
    // KALKULASI (Business Logic / Perhitungan)
    // ============================================
    // Berisi logika perhitungan murni - tidak menyentuh DOM
    // Dipisah dari View agar mudah di-test dan maintain
    const Calc = {
        // Hitung 1 baris data Pelayanan (Pasar)
        // Rumus: AT Meja = T. Meja × 5, AT Neraca = T. Neraca × 19
        // Jumlah = Total semua timbangan + AT Meja + AT Neraca
        hitungBarisPasar(row) {
            const tm = U.num(row.tm);
            const tp = U.num(row.tp);
            const ts = U.num(row.ts);
            const te = U.num(row.te);
            const tn = U.num(row.tn);

            const atMeja = tm * K.AT_MEJA;
            const atNeraca = tn * K.AT_NERACA;
            const jumlah = tm + tp + ts + te + tn + atMeja + atNeraca;

            // Update row dengan hasil perhitungan (mutasi object)
            row.tm = tm; row.tp = tp; row.ts = ts; row.te = te; row.tn = tn;
            row.atMeja = atMeja; row.atNeraca = atNeraca; row.jumlah = jumlah;
            return row;
        },

        // Hitung 1 baris data Target (Dinas) - rumus sama tapi tanpa capaian
        hitungBarisTarget(row) {
            const tm = U.num(row.tm);
            const tp = U.num(row.tp);
            const ts = U.num(row.ts);
            const te = U.num(row.te);
            const tn = U.num(row.tn);

            const atMeja = tm * K.AT_MEJA;
            const atNeraca = tn * K.AT_NERACA;
            const jumlah = tm + tp + ts + te + tn + atMeja + atNeraca;

            row.tm = tm; row.tp = tp; row.ts = ts; row.te = te; row.tn = tn;
            row.atMeja = atMeja; row.atNeraca = atNeraca; row.jumlah = jumlah;
            return row;
        },

        // Hitung SEMUA data: jalankan perhitungan untuk setiap baris
        // Lalu hitung CAPAIAN % = (Jumlah Pelayanan / Jumlah Target) × 100%
        hitungSemua() {
            // 1. Hitung ulang setiap baris pelayanan & target
            State.pelayanan.forEach(r => this.hitungBarisPasar(r));
            State.target.forEach(r => this.hitungBarisTarget(r));

            // 2. Hitung capaian per baris (bandingkan index ke-index)
            // Asumsi: baris ke-i pelayanan dibandingkan dengan baris ke-i target
            const maxLen = Math.max(State.pelayanan.length, State.target.length);
            for (let i = 0; i < maxLen; i++) {
                const p = State.pelayanan[i];
                const t = State.target[i];
                if (p) {
                    // Capaian = 0 jika tidak ada target atau target jumlah = 0
                    p.capaian = t && t.jumlah > 0 ? (p.jumlah / t.jumlah) * 100 : 0;
                }
            }
        },

        // Ambil total per kolom untuk footer tabel
        // Menggunakan reduce untuk sum array of objects
        getTotals() {
            const sum = (arr, field) => arr.reduce((s, r) => s + (r[field] || 0), 0);

            return {
                pasar: {
                    tm: sum(State.pelayanan, 'tm'),
                    tp: sum(State.pelayanan, 'tp'),
                    ts: sum(State.pelayanan, 'ts'),
                    te: sum(State.pelayanan, 'te'),
                    tn: sum(State.pelayanan, 'tn'),
                    atMeja: sum(State.pelayanan, 'atMeja'),
                    atNeraca: sum(State.pelayanan, 'atNeraca'),
                    jumlah: sum(State.pelayanan, 'jumlah')
                },
                target: {
                    tm: sum(State.target, 'tm'),
                    tp: sum(State.target, 'tp'),
                    ts: sum(State.target, 'ts'),
                    te: sum(State.target, 'te'),
                    tn: sum(State.target, 'tn'),
                    atMeja: sum(State.target, 'atMeja'),
                    atNeraca: sum(State.target, 'atNeraca'),
                    jumlah: sum(State.target, 'jumlah')
                }
            };
        }
    };

    // ============================================
    // VIEW  (Menampilkan data ke HTML)
    // ============================================
    // Semua fungsi di sini hanya berurusan dengan DOM (HTML).
    // Karena tabel di-render ulang setiap kali ada perubahan,
    // pastikan jika ingin menambah kolom: ubah juga renderXxxRow,
    // getXxxInputs, updateXxxRow, dan renderFooter.
    const View = {
        els: {},

        cache() {
            this.els = {
                inputTahun: U.$(SEL.inputTahun),
                btnTambahPasar: U.$(SEL.btnTambahPasar),
                tbodyPasar: U.$(SEL.tbodyPasar),
                btnTambahDinas: U.$(SEL.btnTambahDinas),
                tbodyDinas: U.$(SEL.tbodyDinas),
                tbodyHasil: U.$(SEL.tbodyHasil),
                f: {
                    tm: U.$(SEL.totalTM), tp: U.$(SEL.totalTP), ts: U.$(SEL.totalTS),
                    te: U.$(SEL.totalTE), tn: U.$(SEL.totalTN),
                    atMeja: U.$(SEL.atMejaPasar), atNeraca: U.$(SEL.atNeracaPasarTotal),
                    jumlah: U.$(SEL.jumlahPasar), capaian: U.$(SEL.capaianPasar),
                    dinasTM: U.$(SEL.dinasTM), dinasTP: U.$(SEL.dinasTP), dinasTS: U.$(SEL.dinasTS),
                    dinasTE: U.$(SEL.dinasTE), dinasTN: U.$(SEL.dinasTN),
                    dinasATMeja: U.$(SEL.dinasATMeja), dinasATNeraca: U.$(SEL.dinasATNeraca),
                    dinasJumlah: U.$(SEL.dinasJumlah),
                    hasilPasarTotal: U.$(SEL.hasilPasarTotal), hasilDinasTotal: U.$(SEL.hasilDinasTotal),
                    persentaseTotal: U.$(SEL.persentaseTotal)
                }
            };
        },

        renderPasarRow(row) {
            const idx = State.pelayanan.indexOf(row) + 1;
            const capaianClass = U.getCapaianClass(row.capaian);
            const tr = U.create('tr', { dataset: { id: row.id } }, `
                <td class="cell-no">${idx}</td>
                <td><input type="text" class="inp-nama" value="${U.escape(row.nama)}" placeholder="Nama Pasar"></td>
                <td><input type="text" class="inp-alamat" value="${U.escape(row.alamat)}" placeholder="Alamat"></td>
                <td><input type="number" class="inp-num inp-tm" value="${row.tm}" min="0"></td>
                <td><input type="number" class="inp-num inp-tp" value="${row.tp}" min="0"></td>
                <td><input type="number" class="inp-num inp-ts" value="${row.ts}" min="0"></td>
                <td><input type="number" class="inp-num inp-te" value="${row.te}" min="0"></td>
                <td><input type="number" class="inp-num inp-tn" value="${row.tn}" min="0"></td>
                <td class="cell-atmeja">${U.fmt(row.atMeja)}</td>
                <td class="cell-atneraca">${U.fmt(row.atNeraca)}</td>
                <td class="cell-jumlah">${U.fmt(row.jumlah)}</td>
                <td class="cell-capaian ${capaianClass}">${row.capaian.toFixed(2)} %</td>
                <td><button type="button" class="btn-hapus" aria-label="Hapus">Hapus</button></td>
            `);
            return tr;
        },

        renderTargetRow(row) {
            const idx = State.target.indexOf(row) + 1;
            const tr = U.create('tr', { dataset: { id: row.id } }, `
                <td class="cell-no">${idx}</td>
                <td><input type="text" class="inp-nama" value="${U.escape(row.nama)}" placeholder="Nama Target"></td>
                <td><input type="number" class="inp-num inp-tm" value="${row.tm}" min="0"></td>
                <td><input type="number" class="inp-num inp-tp" value="${row.tp}" min="0"></td>
                <td><input type="number" class="inp-num inp-ts" value="${row.ts}" min="0"></td>
                <td><input type="number" class="inp-num inp-te" value="${row.te}" min="0"></td>
                <td><input type="number" class="inp-num inp-tn" value="${row.tn}" min="0"></td>
                <td class="cell-atmeja">${U.fmt(row.atMeja)}</td>
                <td class="cell-atneraca">${U.fmt(row.atNeraca)}</td>
                <td class="cell-jumlah">${U.fmt(row.jumlah)}</td>
                <td><button type="button" class="btn-hapus" aria-label="Hapus">Hapus</button></td>
            `);
            return tr;
        },

        renderAll() {
            // Render ulang SEMUA tabel dari State.
            // Dipakai saat ada operasi besar (misal: import data).
            // Untuk update ringan saat mengetik cukup pakai recalc().
            this.els.tbodyPasar.innerHTML = '';
            State.pelayanan.forEach(r => this.els.tbodyPasar.appendChild(this.renderPasarRow(r)));

            this.els.tbodyDinas.innerHTML = '';
            State.target.forEach(r => this.els.tbodyDinas.appendChild(this.renderTargetRow(r)));

            this.renderHasil();
            this.renderFooter();
        },

        renderHasil() {
            this.els.tbodyHasil.innerHTML = '';
            const maxLen = Math.max(State.pelayanan.length, State.target.length);
            let totalPelayanan = 0, totalTarget = 0;

            for (let i = 0; i < maxLen; i++) {
                const p = State.pelayanan[i];
                const t = State.target[i];
                const jp = p ? p.jumlah : 0;
                const jt = t ? t.jumlah : 0;
                const cap = t && jt > 0 ? (jp / jt) * 100 : 0;

                totalPelayanan += jp;
                totalTarget += jt;

                const capaianClass = U.getCapaianClass(cap);
                const tr = U.create('tr', {}, `
                    <td>${i + 1}</td>
                    <td>${U.escape(p?.nama || '')}</td>
                    <td>${U.escape(p?.alamat || '')}</td>
                    <td>${U.fmt(jp)}</td>
                    <td>${U.fmt(jt)}</td>
                    <td class="${capaianClass}">${cap.toFixed(2)} %</td>
                `);
                this.els.tbodyHasil.appendChild(tr);
            }

            this.els.f.hasilPasarTotal.textContent = U.fmt(totalPelayanan);
            this.els.f.hasilDinasTotal.textContent = U.fmt(totalTarget);
            const totalPct = totalTarget > 0 ? ((totalPelayanan / totalTarget) * 100) : 0;
            const totalClass = U.getCapaianClass(totalPct);
            this.els.f.persentaseTotal.textContent = totalPct.toFixed(2) + ' %';
            this.els.f.persentaseTotal.className = totalClass;
        },

        renderFooter() {
            const totals = Calc.getTotals();

            this.els.f.tm.textContent = U.fmt(totals.pasar.tm);
            this.els.f.tp.textContent = U.fmt(totals.pasar.tp);
            this.els.f.ts.textContent = U.fmt(totals.pasar.ts);
            this.els.f.te.textContent = U.fmt(totals.pasar.te);
            this.els.f.tn.textContent = U.fmt(totals.pasar.tn);
            this.els.f.atMeja.textContent = U.fmt(totals.pasar.atMeja);
            this.els.f.atNeraca.textContent = U.fmt(totals.pasar.atNeraca);
            this.els.f.jumlah.textContent = U.fmt(totals.pasar.jumlah);

            const avgCapaian = State.pelayanan.length > 0
                ? State.pelayanan.reduce((s, r) => s + (r.capaian || 0), 0) / State.pelayanan.length
                : 0;
            const capaianCell = this.els.f.capaian;
            capaianCell.textContent = avgCapaian.toFixed(2) + ' %';
            capaianCell.className = U.getCapaianClass(avgCapaian);

            this.els.f.dinasTM.textContent = U.fmt(totals.target.tm);
            this.els.f.dinasTP.textContent = U.fmt(totals.target.tp);
            this.els.f.dinasTS.textContent = U.fmt(totals.target.ts);
            this.els.f.dinasTE.textContent = U.fmt(totals.target.te);
            this.els.f.dinasTN.textContent = U.fmt(totals.target.tn);
            this.els.f.dinasATMeja.textContent = U.fmt(totals.target.atMeja);
            this.els.f.dinasATNeraca.textContent = U.fmt(totals.target.atNeraca);
            this.els.f.dinasJumlah.textContent = U.fmt(totals.target.jumlah);
        },

        updatePasarRow(tr, row) {
            tr.querySelector('.cell-atmeja').textContent = U.fmt(row.atMeja);
            tr.querySelector('.cell-atneraca').textContent = U.fmt(row.atNeraca);
            tr.querySelector('.cell-jumlah').textContent = U.fmt(row.jumlah);
            const capaianCell = tr.querySelector('.cell-capaian');
            capaianCell.textContent = row.capaian.toFixed(2) + ' %';
            capaianCell.className = 'cell-capaian ' + U.getCapaianClass(row.capaian);
        },

        updateTargetRow(tr, row) {
            tr.querySelector('.cell-atmeja').textContent = U.fmt(row.atMeja);
            tr.querySelector('.cell-atneraca').textContent = U.fmt(row.atNeraca);
            tr.querySelector('.cell-jumlah').textContent = U.fmt(row.jumlah);
        },

        getPasarInputs(tr) {
            return {
                nama: tr.querySelector('.inp-nama').value,
                alamat: tr.querySelector('.inp-alamat').value,
                tm: U.num(tr.querySelector('.inp-tm').value),
                tp: U.num(tr.querySelector('.inp-tp').value),
                ts: U.num(tr.querySelector('.inp-ts').value),
                te: U.num(tr.querySelector('.inp-te').value),
                tn: U.num(tr.querySelector('.inp-tn').value)
            };
        },

        getTargetInputs(tr) {
            return {
                nama: tr.querySelector('.inp-nama').value,
                tm: U.num(tr.querySelector('.inp-tm').value),
                tp: U.num(tr.querySelector('.inp-tp').value),
                ts: U.num(tr.querySelector('.inp-ts').value),
                te: U.num(tr.querySelector('.inp-te').value),
                tn: U.num(tr.querySelector('.inp-tn').value)
            };
        }
    };

    // ============================================
    // CONTROLLER (Menghubungkan semuanya)
    // ============================================
    // Tempat "otak" aplikasi: mendengarkan event dari user,
    // lalu memanggil State (simpan data), Calc (hitung), View (render).
    // init() dipanggil satu kali saat halaman siap.
    const Ctrl = {
        init() {
            View.cache();
            this.bindEvents();
            this.loadInitial();
        },

        bindEvents() {
            const { els } = View;

            els.btnTambahPasar?.addEventListener('click', () => this.addPelayanan());
            els.btnTambahDinas?.addEventListener('click', () => this.addTarget());

            // Export button (main)
            U.$('#btnExportExcel')?.addEventListener('click', () => Export.exportAll());

            els.inputTahun?.addEventListener('change', (e) => {
                State.tahun = U.num(e.target.value) || 2025;
            });

            [els.tbodyPasar, els.tbodyDinas].forEach(tbody => {
                if (!tbody) return;

                tbody.addEventListener('input', (e) => {
                    const tr = e.target.closest('tr');
                    if (!tr) return;
                    const id = Number(tr.dataset.id);

                    if (tbody === els.tbodyPasar) {
                        const data = View.getPasarInputs(tr);
                        State.updatePelayanan(id, 'nama', data.nama);
                        State.updatePelayanan(id, 'alamat', data.alamat);
                        State.updatePelayanan(id, 'tm', data.tm);
                        State.updatePelayanan(id, 'tp', data.tp);
                        State.updatePelayanan(id, 'ts', data.ts);
                        State.updatePelayanan(id, 'te', data.te);
                        State.updatePelayanan(id, 'tn', data.tn);
                    } else {
                        const data = View.getTargetInputs(tr);
                        State.updateTarget(id, 'nama', data.nama);
                        State.updateTarget(id, 'tm', data.tm);
                        State.updateTarget(id, 'tp', data.tp);
                        State.updateTarget(id, 'ts', data.ts);
                        State.updateTarget(id, 'te', data.te);
                        State.updateTarget(id, 'tn', data.tn);
                    }
                    this.recalc();
                });

                tbody.addEventListener('click', (e) => {
                    if (e.target.matches('.btn-hapus')) {
                        const tr = e.target.closest('tr');
                        const id = Number(tr.dataset.id);
                        if (tbody === els.tbodyPasar) State.removePelayanan(id);
                        else State.removeTarget(id);
                        this.recalc();
                    }
                });
            });
        },

        loadInitial() {
            this.addPelayanan();
            this.addTarget();
            this.recalc();
        },

        addPelayanan() {
            const row = State.addPelayanan(`Pasar ${State.pasarId}`, '');
            View.els.tbodyPasar.appendChild(View.renderPasarRow(row));
            this.recalc();
        },

        addTarget() {
            const row = State.addTarget(`Target ${State.targetId}`);
            View.els.tbodyDinas.appendChild(View.renderTargetRow(row));
            this.recalc();
        },

        recalc() {
            Calc.hitungSemua();

            View.els.tbodyPasar.querySelectorAll('tr').forEach(tr => {
                const id = Number(tr.dataset.id);
                const row = State.pelayanan.find(r => r.id === id);
                if (row) View.updatePasarRow(tr, row);
            });

            View.els.tbodyDinas.querySelectorAll('tr').forEach(tr => {
                const id = Number(tr.dataset.id);
                const row = State.target.find(r => r.id === id);
                if (row) View.updateTargetRow(tr, row);
            });

            View.renderHasil();
            View.renderFooter();
        }
    };

    // ============================================
    // EXPORT EXCEL (ExcelJS)
    // ============================================
    // Export hanya mengambil hasil dari State + Calc,
    // membuat worksheet 'Laporan', memberi styling, lalu mengunduh .xlsx
    const Export = {
        // Preset gaya sel (format ExcelJS)
        styles: {
            title: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3C5E' } },
                font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 14, name: 'Calibri' },
                alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }
            },
            info: {
                font: { bold: true, color: { argb: 'FF2C5F8A' }, size: 11, name: 'Calibri' },
                alignment: { horizontal: 'left', vertical: 'middle' }
            },
            section: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C5F8A' } },
                font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12, name: 'Calibri' },
                alignment: { horizontal: 'center', vertical: 'middle' }
            },
            colHeader: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C5F8A' } },
                font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' },
                alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
                border: {
                    top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
                }
            },
            colHeaderDinas: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3C5E' } },
                font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' },
                alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
                border: {
                    top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
                }
            },
            colHeaderPasar: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE67E22' } },
                font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' },
                alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
                border: {
                    top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
                }
            },
            colHeaderHasil: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF27AE60' } },
                font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' },
                alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
                border: {
                    top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                    right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
                }
            },
            borderThin: {
                top: { style: 'thin', color: { argb: 'FFE1E8ED' } },
                bottom: { style: 'thin', color: { argb: 'FFE1E8ED' } },
                left: { style: 'thin', color: { argb: 'FFE1E8ED' } },
                right: { style: 'thin', color: { argb: 'FFE1E8ED' } }
            },
            borderMedium: {
                top: { style: 'medium', color: { argb: 'FF2C5F8A' } },
                bottom: { style: 'medium', color: { argb: 'FF2C5F8A' } },
                left: { style: 'medium', color: { argb: 'FF2C5F8A' } },
                right: { style: 'medium', color: { argb: 'FF2C5F8A' } }
            },
            data: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
                font: { size: 11, name: 'Calibri' },
                alignment: { horizontal: 'center', vertical: 'middle' }
            },
            dataLeft: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } },
                font: { size: 11, name: 'Calibri' },
                alignment: { horizontal: 'left', vertical: 'middle' }
            },
            dataEven: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } },
                font: { size: 11, name: 'Calibri' },
                alignment: { horizontal: 'center', vertical: 'middle' }
            },
            dataEvenLeft: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } },
                font: { size: 11, name: 'Calibri' },
                alignment: { horizontal: 'left', vertical: 'middle' }
            },
            total: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF3F8' } },
                font: { bold: true, size: 11, color: { argb: 'FF1A3C5E' }, name: 'Calibri' },
                alignment: { horizontal: 'center', vertical: 'middle' }
            },
            capaianHijau: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } },
                font: { bold: true, color: { argb: 'FF2E7D32' }, size: 11, name: 'Calibri' },
                alignment: { horizontal: 'center', vertical: 'middle' }
            },
            capaianKuning: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF8E1' } },
                font: { bold: true, color: { argb: 'FFF57F17' }, size: 11, name: 'Calibri' },
                alignment: { horizontal: 'center', vertical: 'middle' }
            },
            capaianMerah: {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDEDEC' } },
                font: { bold: true, color: { argb: 'FFC0392B' }, size: 11, name: 'Calibri' },
                alignment: { horizontal: 'center', vertical: 'middle' }
            },
            summaryLabel: {
                font: { bold: true, color: { argb: 'FF2C5F8A' }, size: 11, name: 'Calibri' },
                alignment: { horizontal: 'left', vertical: 'middle' },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F5FA' } }
            },
            summaryValue: {
                font: { bold: true, color: { argb: 'FF1A3C5E' }, size: 11, name: 'Calibri' },
                alignment: { horizontal: 'center', vertical: 'middle' },
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F5FA' } }
            }
        },

        // Tulis 1 sel lengkap dengan nilai, gaya, dan format angka
        cell(ws, r, c, value, style, numFmt, border) {
            const cell = ws.getCell(r, c);
            cell.value = value;
            if (style) {
                if (style.fill) cell.fill = style.fill;
                if (style.font) cell.font = style.font;
                if (style.alignment) cell.alignment = style.alignment;
            }
            if (border) cell.border = border;
            if (numFmt) cell.numFmt = numFmt;
        },

        // Tulis seluruh baris data sekaligus
        writeRow(ws, r, values, opts) {
            values.forEach((v, idx) => {
                const c = idx + 1;
                const style = opts.styles[c];
                if (!style) return;
                this.cell(ws, r, c, v, style, opts.numFmts ? opts.numFmts[c] : undefined, opts.border || this.styles.borderThin);
            });
        },

        // Export semua data ke 1 sheet "Laporan"
        async exportAll() {
            try {
                Calc.hitungSemua();

                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Laporan');
                const S = this.styles;
                const B = S.borderThin;
                const BM = S.borderMedium;

                // Lebar kolom (No s.d. Capaian)
                const widths = [8, 28, 38, 12, 12, 15, 15, 12, 12, 14, 15, 14];
                widths.forEach((w, i) => { worksheet.getColumn(i + 1).width = w; });

                let row = 1;
                const LAST_COL = 12;

                // ===== JUDUL LAPORAN =====
                worksheet.mergeCells(`A${row}:L${row}`);
                this.cell(worksheet, row, 1, 'PERHITUNGAN CAPAIAN KINERJA UPTD METROLOGI LEGAL', S.title);
                worksheet.getRow(row).height = 32;
                row++;

                worksheet.mergeCells(`A${row}:L${row}`);
                this.cell(worksheet, row, 1, `TAHUN: ${State.tahun}`, S.info);
                row++;

                worksheet.mergeCells(`A${row}:L${row}`);
                this.cell(worksheet, row, 1, `Tanggal Export: ${new Date().toLocaleDateString('id-ID')}`, S.info);
                row++;
                row++; // baris kosong

                // Helper: baris judul seksi (di-merge A:L, tanpa border)
                const sectionRow = (label) => {
                    worksheet.mergeCells(`A${row}:L${row}`);
                    this.cell(worksheet, row, 1, label, S.section);
                    worksheet.getRow(row).height = 22;
                    row++;
                };

                // Helper: baris header tabel (semua kolom ber-border colHeader)
                const tableHeaderRow = (headers, headerStyle) => {
                    headers.forEach((h, idx) => {
                        this.cell(worksheet, row, idx + 1, h, headerStyle || S.colHeader, undefined, (headerStyle || S.colHeader).border);
                    });
                    worksheet.getRow(row).height = 30;
                    const r = row;
                    row++;
                    return r;
                };

                // ===== DATA PELAYANAN TERA ULANG (PASAR) =====
                sectionRow('DATA PELAYANAN TERA ULANG (PASAR)');
                const pasarHeaderRow = tableHeaderRow([
                    'No', 'Nama Pasar', 'Alamat',
                    'T. Meja', 'T. Pegas', 'T. Sentismal', 'T. Elektronik', 'T. Neraca',
                    'AT Meja', 'AT Neraca', 'Jumlah', 'Capaian (%)'
                ], S.colHeaderPasar);

                let n = 0;
                State.pelayanan.forEach((p) => {
                    const even = n % 2 === 1;
                    const st = {
                        1: even ? S.dataEven : S.data,
                        2: even ? S.dataEvenLeft : S.dataLeft,
                        3: even ? S.dataEvenLeft : S.dataLeft,
                        4: even ? S.dataEven : S.data,
                        5: even ? S.dataEven : S.data,
                        6: even ? S.dataEven : S.data,
                        7: even ? S.dataEven : S.data,
                        8: even ? S.dataEven : S.data,
                        9: even ? S.dataEven : S.data,
                        10: even ? S.dataEven : S.data,
                        11: even ? S.dataEven : S.data
                    };
                    const numFmts = {
                        4: '#,##0', 5: '#,##0', 6: '#,##0', 7: '#,##0', 8: '#,##0',
                        9: '#,##0', 10: '#,##0', 11: '#,##0'
                    };
                    this.writeRow(worksheet, row, [n + 1, p.nama, p.alamat, p.tm, p.tp, p.ts, p.te, p.tn, p.atMeja, p.atNeraca, p.jumlah], { styles: st, numFmts, border: B });
                    // Kolom capaian: nilai numerik + format persen + warna sesuai nilai
                    const capStylePasar = p.capaian >= 80 ? S.capaianHijau : (p.capaian >= 50 ? S.capaianKuning : S.capaianMerah);
                    this.cell(worksheet, row, 12, p.capaian / 100, capStylePasar, '0.00%', B);
                    worksheet.getRow(row).height = 20;
                    row++;
                    n++;
                });
                const pasarDataEnd = row - 1;

                const totalsP = Calc.getTotals().pasar;
                const totalNumFmts = { 4: '#,##0', 5: '#,##0', 6: '#,##0', 7: '#,##0', 8: '#,##0', 9: '#,##0', 10: '#,##0', 11: '#,##0' };
                const totalSt = {};
                for (let c = 1; c <= LAST_COL; c++) totalSt[c] = S.total;
                this.writeRow(worksheet, row, ['', 'TOTAL', '', totalsP.tm, totalsP.tp, totalsP.ts, totalsP.te, totalsP.tn, totalsP.atMeja, totalsP.atNeraca, totalsP.jumlah, ''], { styles: totalSt, numFmts: totalNumFmts, border: BM });
                worksheet.getRow(row).height = 22;
                row++;
                row++; // baris kosong

                // ===== DATA TARGET DINAS (KETENTUAN) =====
                sectionRow('DATA TARGET DINAS (KETENTUAN)');
                const targetHeaderRow = tableHeaderRow([
                    'No', 'Nama Target', '',
                    'T. Meja', 'T. Pegas', 'T. Sentismal', 'T. Elektronik', 'T. Neraca',
                    'AT Meja', 'AT Neraca', 'Jumlah', ''
                ], S.colHeaderDinas);

                n = 0;
                State.target.forEach((t) => {
                    const even = n % 2 === 1;
                    const st = {
                        1: even ? S.dataEven : S.data,
                        2: even ? S.dataEvenLeft : S.dataLeft,
                        3: even ? S.dataEven : S.data,
                        4: even ? S.dataEven : S.data,
                        5: even ? S.dataEven : S.data,
                        6: even ? S.dataEven : S.data,
                        7: even ? S.dataEven : S.data,
                        8: even ? S.dataEven : S.data,
                        9: even ? S.dataEven : S.data,
                        10: even ? S.dataEven : S.data,
                        11: even ? S.dataEven : S.data,
                        12: even ? S.dataEven : S.data
                    };
                    const numFmts = {
                        4: '#,##0', 5: '#,##0', 6: '#,##0', 7: '#,##0', 8: '#,##0',
                        9: '#,##0', 10: '#,##0', 11: '#,##0'
                    };
                    this.writeRow(worksheet, row, [n + 1, t.nama, '', t.tm, t.tp, t.ts, t.te, t.tn, t.atMeja, t.atNeraca, t.jumlah, ''], { styles: st, numFmts, border: B });
                    worksheet.getRow(row).height = 20;
                    row++;
                    n++;
                });
                const targetDataEnd = row - 1;

                const totalsT = Calc.getTotals().target;
                this.writeRow(worksheet, row, ['', 'TOTAL', '', totalsT.tm, totalsT.tp, totalsT.ts, totalsT.te, totalsT.tn, totalsT.atMeja, totalsT.atNeraca, totalsT.jumlah, ''], { styles: totalSt, numFmts: totalNumFmts, border: BM });
                worksheet.getRow(row).height = 22;
                row++;
                row++; // baris kosong

                // ===== HASIL PERHITUNGAN CAPAIAN =====
                sectionRow('HASIL PERHITUNGAN CAPAIAN');
                const hasilHeaderRow = tableHeaderRow([
                    'No', 'Pasar', 'Alamat', 'Jumlah Pelayanan', 'Jumlah Target', 'Capaian (%)',
                    '', '', '', '', '', ''
                ], S.colHeaderHasil);

                const maxLen = Math.max(State.pelayanan.length, State.target.length);
                let totalPelayanan = 0, totalTarget = 0;

                n = 0;
                for (let i = 0; i < maxLen; i++) {
                    const p = State.pelayanan[i];
                    const t = State.target[i];
                    const jp = p ? p.jumlah : 0;
                    const jt = t ? t.jumlah : 0;
                    const cap = t && jt > 0 ? (jp / jt) * 100 : 0;
                    totalPelayanan += jp;
                    totalTarget += jt;

                    const even = n % 2 === 1;
                    const st = {
                        1: even ? S.dataEven : S.data,
                        2: even ? S.dataEvenLeft : S.dataLeft,
                        3: even ? S.dataEvenLeft : S.dataLeft,
                        4: even ? S.dataEven : S.data,
                        5: even ? S.dataEven : S.data
                    };
                    const numFmts = { 4: '#,##0', 5: '#,##0' };
                    this.writeRow(worksheet, row, [i + 1, p?.nama || '', p?.alamat || '', jp, jt], { styles: st, numFmts, border: B });

                    const capStyleHasil = cap >= 80 ? S.capaianHijau : (cap >= 50 ? S.capaianKuning : S.capaianMerah);
                    this.cell(worksheet, row, 6, cap / 100, capStyleHasil, '0.00%', B);

                    worksheet.getRow(row).height = 20;
                    row++;
                    n++;
                }
                const hasilDataEnd = row - 1;

                const hasilTotalSt = {};
                for (let c = 1; c <= 6; c++) hasilTotalSt[c] = S.total;
                const hasilTotalNumFmts = { 4: '#,##0', 5: '#,##0' };
                const capTotal = totalTarget > 0 ? (totalPelayanan / totalTarget) * 100 : 0;
                this.writeRow(worksheet, row, ['', 'TOTAL', '', totalPelayanan, totalTarget], { styles: hasilTotalSt, numFmts: hasilTotalNumFmts, border: BM });
                const capTotalStyle = capTotal >= 80 ? S.capaianHijau : (capTotal >= 50 ? S.capaianKuning : S.capaianMerah);
                this.cell(worksheet, row, 6, capTotal / 100, capTotalStyle, '0.00%', BM);
                worksheet.getRow(row).height = 22;
                row++;
                row++; // baris kosong

                // ===== RINGKASAN =====
                sectionRow('RINGKASAN');
                const ringkasanData = [
                    ['Tahun', State.tahun, ''],
                    ['Total Pelayanan', totalPelayanan, '#,##0'],
                    ['Total Target', totalTarget, '#,##0'],
                    ['Capaian Keseluruhan (%)', capTotal / 100, '0.00%']
                ];
                ringkasanData.forEach(([label, value, fmt]) => {
                    this.cell(worksheet, row, 1, label, S.summaryLabel, undefined, B);
                    worksheet.mergeCells(`B${row}:C${row}`);
                    this.cell(worksheet, row, 2, value, S.summaryValue, fmt, B);
                    worksheet.getRow(row).height = 20;
                    row++;
                });

                // ===== FREEZE PANE (header tabel utama tetap terlihat) =====
                worksheet.views = [{ state: 'frozen', ySplit: pasarHeaderRow - 1 }];

                // ===== AUTO FILTER (tabel utama) =====
                if (State.pelayanan.length > 0) {
                    worksheet.autoFilter = `A${pasarHeaderRow}:L${pasarDataEnd}`;
                }

                // ===== PRINT SETUP =====
                worksheet.pageSetup = {
                    orientation: 'landscape',
                    fitToPage: true,
                    fitToWidth: 1,
                    fitToHeight: 0,
                    paperSize: 9, // A4
                    margins: { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }
                };

                // ===== DOWNLOAD FILE =====
                const buffer = await workbook.xlsx.writeBuffer();
                const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
                const fileName = `Laporan_Capaian_Tera_${State.tahun}.xlsx`;
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                setTimeout(() => URL.revokeObjectURL(url), 1000);

                alert('Export Excel berhasil.');
            } catch (error) {
                console.error(error);
                alert('Gagal membuat file Excel.');
            }
        }
    };


    // START (Titik awal aplikasi)
    // Menunggu sampai DOM selesai dimuat, baru jalankan Ctrl.init()
    // (guard: kalau DOM sudah siap, langsung jalankan tanpa tunggu)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Ctrl.init());
    } else {
        Ctrl.init();
    }
})();