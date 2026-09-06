/* ==========================================================================
   MILLE FLEURS — script.js
   ใช้ร่วมกันทุกหน้า: ตรวจจาก element ที่มีอยู่ในหน้านั้นๆ ว่าต้องรันฟังก์ชันไหน
   ========================================================================== */

(function () {
  'use strict';

  var PRODUCTS_JSON_PATH = 'products.json';
  var ORDER_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzbOAVB75nblO9UEr5IDONGgU3HvT0BMg_mAlUsTwVXtXOuoBwobq4nZLuSqlFsw5annw/exec';
  var ORDERS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTiiRguzZd8GnLcHzRl908YiFk9EXsNEcF8_YRHocl3eDct_VLDefM0cLv-0i30hRs-03llblYVupru/pub?gid=0&single=true&output=csv';

  var MOODS = [
    'Recovery & Repair',
    'Scalp Balance & Anti-Dandruff',
    'Deep Moisture & Glossy',
    'Organic Anti-Hair Fall'
  ];

  document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('product-list')) {
      initProductPage();
    }
    if (document.getElementById('orderForm')) {
      initOrderPage();
    }
    if (document.querySelector('#ordersTable tbody')) {
      initAdminPage();
    }
  });

  /* ========================================================================
     1) product.html — โหลดสินค้า, ปุ่มกรอง mood, ?mood=xxx
     ======================================================================== */

  function initProductPage() {
    var listEl = document.getElementById('product-list');
    var filterBarEl = document.getElementById('filter-bar');

    fetch(PRODUCTS_JSON_PATH)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        var products = data.products || [];
        var params = new URLSearchParams(window.location.search);
        var initialMood = params.get('mood') || 'all';

        renderFilterBar(filterBarEl, initialMood, function (mood) {
          renderProductList(listEl, products, mood);
        });

        renderProductList(listEl, products, initialMood);
      })
      .catch(function (error) {
        console.error(error);
        listEl.innerHTML = '<p>ไม่สามารถโหลดข้อมูลสินค้าได้ในขณะนี้</p>';
      });
  }

  function renderFilterBar(filterBarEl, activeMood, onChange) {
    if (!filterBarEl) return;

    var allPills = [{ label: 'ทั้งหมด', mood: 'all' }].concat(
      MOODS.map(function (m) { return { label: m, mood: m }; })
    );

    filterBarEl.innerHTML = '';

    allPills.forEach(function (pillData) {
      var pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'mood-pill' + (pillData.mood === activeMood ? ' is-active' : '');
      pill.textContent = pillData.label;
      if (pillData.mood !== 'all') {
        pill.setAttribute('data-mood', pillData.mood);
      }

      pill.addEventListener('click', function () {
        var pills = filterBarEl.querySelectorAll('.mood-pill');
        pills.forEach(function (p) { p.classList.remove('is-active'); });
        pill.classList.add('is-active');

        updateMoodQueryParam(pillData.mood);
        onChange(pillData.mood);
      });

      filterBarEl.appendChild(pill);
    });
  }

  function updateMoodQueryParam(mood) {
    var url = new URL(window.location.href);
    if (mood === 'all') {
      url.searchParams.delete('mood');
    } else {
      url.searchParams.set('mood', mood);
    }
    window.history.replaceState({}, '', url);
  }

  function renderProductList(listEl, products, mood) {
    if (!listEl) return;

    var filtered = (mood === 'all' || !mood)
      ? products
      : products.filter(function (p) { return p.mood === mood; });

    listEl.innerHTML = '';

    if (filtered.length === 0) {
      listEl.innerHTML = '<p>ไม่พบสินค้าในหมวดนี้</p>';
      return;
    }

    filtered.forEach(function (product) {
      listEl.appendChild(buildProductCard(product));
    });
  }

  function buildProductCard(product) {
    var card = document.createElement('article');
    card.className = 'product-card';
    card.setAttribute('data-mood', product.mood);

    var imageWrap = document.createElement('div');
    imageWrap.className = 'product-card__image';
    var img = document.createElement('img');
    img.src = product.image;
    img.alt = product.name;
    img.loading = 'lazy';
    imageWrap.appendChild(img);

    var body = document.createElement('div');
    body.className = 'product-card__body';

    var moodEl = document.createElement('span');
    moodEl.className = 'product-card__mood';
    moodEl.textContent = product.mood;

    var nameEl = document.createElement('h3');
    nameEl.className = 'product-card__name';
    nameEl.textContent = product.name;

    var sizeEl = document.createElement('p');
    sizeEl.className = 'product-card__size';
    sizeEl.textContent = product.size;

    var footer = document.createElement('div');
    footer.className = 'product-card__footer';

    var priceEl = document.createElement('span');
    priceEl.className = 'product-card__price';
    priceEl.textContent = product.price;

    var orderLink = document.createElement('a');
    orderLink.className = 'btn btn--primary';
    orderLink.textContent = 'สั่งซื้อ';
    var orderParams = new URLSearchParams();
    orderParams.set('item', product.name);
    orderParams.set('price', product.price);
    orderLink.href = 'order.html?' + orderParams.toString();

    footer.appendChild(priceEl);
    footer.appendChild(orderLink);

    body.appendChild(moodEl);
    body.appendChild(nameEl);
    body.appendChild(sizeEl);
    body.appendChild(footer);

    card.appendChild(imageWrap);
    card.appendChild(body);

    return card;
  }

  /* ========================================================================
     2) order.html — เติมฟอร์มจาก URL param, ส่งออเดอร์ไป Apps Script
     ======================================================================== */

  function initOrderPage() {
    var form = document.getElementById('orderForm');
    var itemsField = document.getElementById('items');
    var totalField = document.getElementById('total');

    var params = new URLSearchParams(window.location.search);
    var item = params.get('item');
    var price = params.get('price');

    if (itemsField && item) {
      itemsField.value = item;
    }
    if (totalField && price) {
      totalField.value = price;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var payload = {
        customerName: getFieldValue('customerName'),
        contact: getFieldValue('contact'),
        items: getFieldValue('items'),
        total: getFieldValue('total'),
        note: getFieldValue('note')
      };

      fetch(ORDER_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
        .then(function () {
          window.location.href = 'thankyou.html';
        })
        .catch(function (error) {
          console.error(error);
          alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        });
    });
  }

  function getFieldValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  /* ========================================================================
     3) admin.html — ดึง CSV จาก Google Sheets แล้ว parse เอง, เรียงล่าสุดก่อน
     ======================================================================== */

  function initAdminPage() {
    var tbody = document.querySelector('#ordersTable tbody');

    fetch(ORDERS_CSV_URL)
      .then(function (res) { return res.text(); })
      .then(function (csvText) {
        var rows = parseCSV(csvText);
        if (rows.length === 0) return;

        var header = rows[0];
        var dataRows = rows.slice(1).filter(function (row) {
          return row.some(function (cell) { return cell.trim() !== ''; });
        });

        // แถวล่าสุดขึ้นก่อน: สมมติคอลัมน์แรกเป็นวันเวลาที่เรียงจากบนลงล่างตามลำดับการบันทึก
        dataRows.reverse();

        renderOrdersTable(tbody, dataRows);
      })
      .catch(function (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="6">ไม่สามารถโหลดข้อมูลออเดอร์ได้ในขณะนี้</td></tr>';
      });
  }

  function renderOrdersTable(tbody, rows) {
    tbody.innerHTML = '';

    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      // คอลัมน์ที่คาดไว้: วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
      for (var i = 0; i < 6; i++) {
        var td = document.createElement('td');
        td.textContent = row[i] !== undefined ? row[i] : '';
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
  }

  // Parser CSV แบบเขียนเอง รองรับ field ที่ครอบด้วย " และมี , หรือ " หรือขึ้นบรรทัดใหม่อยู่ข้างใน
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var insideQuotes = false;

    // ตัด BOM ถ้ามี และปรับ \r\n ให้เหลือ \n
    text = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (var i = 0; i < text.length; i++) {
      var char = text[i];

      if (insideQuotes) {
        if (char === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            insideQuotes = false;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"') {
        insideQuotes = true;
        continue;
      }

      if (char === ',') {
        row.push(field);
        field = '';
        continue;
      }

      if (char === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        continue;
      }

      field += char;
    }

    // เก็บ field/row สุดท้ายถ้ายังไม่ได้ push (ไฟล์ไม่ได้จบด้วย \n)
    if (field !== '' || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }
})();
