(function () {
  'use strict';

  var container = document.getElementById('slots');
  var slots = Array.prototype.slice.call(container.querySelectorAll('.slot'));
  var activeSlot = null;

  var LOAD_ERROR_TEXT = '이 이미지는 불러올 수 없어요. 이미지 복사로 붙여넣어 보세요';

  // http/https로 시작하는 주소인지 확인
  function isHttpUrl(text) {
    return /^https?:\/\/\S+$/i.test(text);
  }

  // 클립보드/드롭 데이터에서 이미지를 꺼냄. { src, isObjectURL } 또는 null 반환
  function getImageFromDataTransfer(dataTransfer) {
    if (!dataTransfer) return null;

    // 1. 이미지 파일 (items → files 순서)
    var file = null;
    var items = dataTransfer.items;
    if (items) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type.indexOf('image/') === 0) {
          file = items[i].getAsFile();
          if (file) break;
        }
      }
    }
    if (!file && dataTransfer.files) {
      for (var j = 0; j < dataTransfer.files.length; j++) {
        if (dataTransfer.files[j].type.indexOf('image/') === 0) {
          file = dataTransfer.files[j];
          break;
        }
      }
    }
    if (file) {
      return { src: URL.createObjectURL(file), isObjectURL: true };
    }

    // 2. text/html 안의 img 태그 src
    var html = dataTransfer.getData('text/html');
    if (html) {
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var imgs = doc.querySelectorAll('img[src]');
      for (var k = 0; k < imgs.length; k++) {
        var src = imgs[k].getAttribute('src').trim();
        if (src.indexOf('//') === 0) src = 'https:' + src;
        if (isHttpUrl(src) || src.indexOf('data:image/') === 0) {
          return { src: src, isObjectURL: false };
        }
      }
    }

    // 3. text/uri-list 또는 text/plain 의 http(s) 주소
    var uriList = dataTransfer.getData('text/uri-list');
    if (uriList) {
      var lines = uriList.split(/\r?\n/);
      for (var m = 0; m < lines.length; m++) {
        var line = lines[m].trim();
        if (line && line.charAt(0) !== '#' && isHttpUrl(line)) {
          return { src: line, isObjectURL: false };
        }
      }
    }
    var plain = (dataTransfer.getData('text/plain') || '').trim();
    if (isHttpUrl(plain)) {
      return { src: plain, isObjectURL: false };
    }

    // 4. 이미지 없음
    return null;
  }

  // 칸에 남아 있는 objectURL 해제
  function revokeSlotUrl(slot) {
    if (slot.dataset.objectUrl) {
      URL.revokeObjectURL(slot.dataset.objectUrl);
      delete slot.dataset.objectUrl;
    }
  }

  // 칸을 빈 상태로 되돌림
  function clearSlot(slot) {
    var img = slot.querySelector('.slot-area img');
    if (img) img.remove();
    revokeSlotUrl(slot);
    slot.classList.remove('filled');
  }

  // 칸에 오류 문구를 잠깐 보여줌
  function showError(slot, text) {
    var el = slot.querySelector('.slot-error');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(slot._errorTimer);
    slot._errorTimer = setTimeout(function () {
      el.hidden = true;
    }, 3000);
  }

  // 칸에 이미지를 넣음 (이전 이미지와 objectURL은 정리)
  function setSlotImage(slot, image) {
    clearSlot(slot);
    slot.querySelector('.slot-error').hidden = true;

    var img = document.createElement('img');
    img.alt = '';
    if (image.isObjectURL) {
      slot.dataset.objectUrl = image.src;
    } else {
      img.referrerPolicy = 'no-referrer';
      img.setAttribute('referrerpolicy', 'no-referrer');
    }
    img.onerror = function () {
      // 그 사이 다른 이미지로 바뀌었으면 무시
      if (!img.isConnected) return;
      clearSlot(slot);
      showError(slot, LOAD_ERROR_TEXT);
    };
    img.src = image.src;

    slot.querySelector('.slot-area').appendChild(img);
    slot.classList.add('filled');
  }

  // 선택된 칸 표시 갱신
  function setActive(slot) {
    if (activeSlot) activeSlot.classList.remove('active');
    activeSlot = slot;
    if (activeSlot) activeSlot.classList.add('active');
  }

  // 붙여넣기 대상 칸: 마지막 선택 칸 → 첫 빈 칸 → 첫 칸
  function getPasteTarget() {
    if (activeSlot) return activeSlot;
    for (var i = 0; i < slots.length; i++) {
      if (!slots[i].classList.contains('filled')) return slots[i];
    }
    return slots[0];
  }

  // 컨테이너 클릭 하나로 비우기/칸 선택 처리 (이벤트 위임)
  container.addEventListener('click', function (e) {
    var clearBtn = e.target.closest('button.clear');
    if (clearBtn) {
      clearSlot(clearBtn.closest('.slot'));
      return;
    }
    var slot = e.target.closest('.slot');
    if (slot) setActive(slot);
  });

  // 붙여넣기: 이미지가 없으면 조용히 무시
  document.addEventListener('paste', function (e) {
    var image = getImageFromDataTransfer(e.clipboardData);
    if (!image) return;
    e.preventDefault();
    setSlotImage(getPasteTarget(), image);
  });

  // 드래그앤드롭: 각 칸에 등록
  slots.forEach(function (slot) {
    slot.addEventListener('dragenter', function (e) {
      e.preventDefault();
      slot.classList.add('dragover');
    });

    slot.addEventListener('dragover', function (e) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      slot.classList.add('dragover');
    });

    slot.addEventListener('dragleave', function (e) {
      // 칸 안의 자식 요소로 이동한 경우는 무시
      if (e.relatedTarget && slot.contains(e.relatedTarget)) return;
      slot.classList.remove('dragover');
    });

    slot.addEventListener('drop', function (e) {
      e.preventDefault();
      var target = e.target.closest('.slot');
      target.classList.remove('dragover');
      var image = getImageFromDataTransfer(e.dataTransfer);
      if (!image) return;
      setSlotImage(target, image);
      setActive(target);
    });
  });

  // 칸 밖에 떨어뜨려도 브라우저가 이미지 파일로 이동하지 않도록 막음
  window.addEventListener('dragover', function (e) {
    e.preventDefault();
  });
  window.addEventListener('drop', function (e) {
    e.preventDefault();
  });
})();
