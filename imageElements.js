/**
 * 图片元素创建模块
 * 包含款式和印花图片元素创建的相关功能
 */

/**
 * 创建款式图片元素
 * @param {string} imageData 图片数据URL
 * @returns {Object} 包含款式元素的集合
 */
export function createStyleElement(imageData) {
    const styleItem = $('<div class="style-item"></div>');
    const img = $(`<img class="styleBg" src="${imageData}">`);
    const deleteBtn = $('<div class="delete-stamp">×</div>');
    const syncBtn = $('<div class="sync-stamp">同步印花位置</div>');

    // 添加同步按钮点击处理
    syncBtn.on('click', function () {
        // 清空全局印花位置数据
        window.globalStampPosition.x = 0;
        window.globalStampPosition.top = 0;
        window.globalStampPosition.width = 0;
        window.globalStampPosition.height = 0;
        // 获取当前印花位置
        const marker = styleItem.find('.position-marker[data-active="true"]');
        if (marker.length) {
            // 1. 获取 transform 的 translate 值
            const transform = marker.css('transform');
            let translateX = 0, translateY = 0;

            // 解析 matrix 或 translate 格式
            if (transform && transform !== 'none') {
                // 情况1：matrix(a, b, c, d, tx, ty)
                if (transform.startsWith('matrix')) {
                    const matrix = transform.match(/matrix\((.+)\)/)[1].split(', ');
                    translateX = parseFloat(matrix[4]); // 第5个值是 tx (X位移)
                    translateY = parseFloat(matrix[5]); // 第6个值是 ty (Y位移)
                }
                // 情况2：translate(tx, ty)
                else if (transform.startsWith('translate')) {
                    const translate = transform.match(/translate\((.+)\)/)[1].split(', ');
                    translateX = parseFloat(translate[0]);
                    translateY = parseFloat(translate[1]);
                }
            }
            // 2. 赋值给全局变量
            window.globalStampPosition.x = translateX;
            window.globalStampPosition.y = translateY;
            window.globalStampPosition.width = parseFloat(marker.css('width'));
            window.globalStampPosition.height = parseFloat(marker.css('height'));

            // 3. 更新底部显示
            $('#stamp-position-display').text(
                `印花位置: 左${translateX}px 上${translateY}px 宽${window.globalStampPosition.width}px 高${window.globalStampPosition.height}px`
            );
            // 4. 同步到所有款式（修正后的代码）
            $('.style-item').each(function () {
                const item = $(this);
                const targetMarker = item.find('.position-marker[data-active="true"]');

                if (targetMarker.length) {
                    targetMarker.css({
                        transform: `translate(${translateX}px, ${translateY}px)`,
                        width: `${window.globalStampPosition.width}px`,
                        height: `${window.globalStampPosition.height}px`
                    }).attr({  // 同步 data-* 属性
                        'data-x': translateX,
                        'data-y': translateY,
                        'data-width': window.globalStampPosition.width,
                        'data-height': window.globalStampPosition.height
                    });;
                }
            });


        }
    });

    // 添加删除按钮
    styleItem.append(syncBtn, deleteBtn);

    // 为款式图片添加位置标记功能
    styleItem.append('<div class="position-markers"></div>');

    // 添加4个默认位置标记
    const positions = [
        { transform: 'translate(0, 0)', width: 160, height: 200, name: '默认' },
    ];

    positions.forEach((pos, index) => {
        const marker = $(`
            <div class="position-marker" data-index="${index}" 
                 data-active="${index === 0 ? 'true' : 'false'}"
                 style="tranform: translate(${pos.x}px, ${pos.y}px); 
                        width:${pos.width}px; height:${pos.height}px">
                <img class="stampReview" src="" alt="">
            </div>
        `);
        styleItem.find('.position-markers').append(marker);
    });

    return {
        styleItem,
        img,
        deleteBtn
    };
}

/**
 * 创建印花图片元素
 * @param {string} imageData 图片数据URL
 * @returns {Object} 包含印花元素的集合
 */
export function createStampElement(imageData) {
    const stampItem = $('<div class="stamp-item"></div>');
    const img = $(`<img src="${imageData}">`);
    const deleteBtn = $('<div class="delete-stamp">×</div>');

    return {
        stampItem,
        img,
        deleteBtn
    };
}

/**
 * 处理图片上传
 * @param {Event} e 上传事件
 * @param {string} type 类型：'style'或'stamp'
 * @param {function} callback 回调函数
 */
export function handleUpload(e, type, callback) {
    const files = e.target.files || e.originalEvent.dataTransfer.files;
    const previewArea = $(`#${type}Preview`);

    Array.from(files)
        .filter(file => file.type.match('image.*'))
        .forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = e.target.result;
                callback(imageData, file.name);
            };
            reader.readAsDataURL(file);
        });
}

/**
 * 设置拖拽上传
 * @param {string} containerSelector 容器选择器
 * @param {string} inputSelector 文件输入选择器
 * @param {string} type 类型：'style'或'stamp'
 * @param {function} callback 回调函数
 */
export function setupDragUpload(containerSelector, inputSelector, type, callback) {
    const container = $(containerSelector);
    const input = $(inputSelector);

    container.on('dragover', function (e) {
        e.preventDefault();
        container.addClass('drag-over');
    });

    container.on('dragleave', function () {
        container.removeClass('drag-over');
    });

    container.on('drop', function (e) {
        e.preventDefault();
        container.removeClass('drag-over');
        input[0].files = e.originalEvent.dataTransfer.files;
        input.trigger('change');
    });

    // 监听文件变化
    input.on('change', function (e) {
        handleUpload(e, type, callback);
    });
}