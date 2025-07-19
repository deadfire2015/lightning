import {
    createStyleElement,
    createStampElement,
    handleUpload,
    setupDragUpload
} from './imageElements.js';

// 全局缩放系数
let globalScaleFactor = 1;
window.globalScaleFactor = globalScaleFactor;

// 全局印花位置数据
const globalStampPosition = {
    x: 0,
    y: 0,
    width: 200,
    height: 200
};
window.globalStampPosition = globalStampPosition;

$(document).ready(function () {
    /**
     * 更新印花预览
     * @param {jQuery} styleItem 款式图片元素
     * @param {jQuery} marker 激活的位置标记
     */
    const updateStampPreview = (styleItem, marker, stampName) => {
        const previewImg = styleItem.find('.stampreview')[0];
        const markerImg = marker.find('img')[0];
        // 更新预览图片源和alt属性
        $(previewImg).attr('src', markerImg.src);
        $(previewImg).attr('alt', stampName);

        // 获取marker的实际尺寸(包括transform缩放)
        const markerRect = marker[0].getBoundingClientRect();
        const styleRect = styleItem[0].getBoundingClientRect();

        // 计算相对于款式图片的位置
        const left = markerRect.left - styleRect.left;
        const top = markerRect.top - styleRect.top;

        // 计算保持比例的尺寸
        const imgAspectRatio = markerImg.naturalWidth / markerImg.naturalHeight;
        const markerWidth = markerRect.width;
        const markerHeight = markerRect.height;

        let adjustedWidth, adjustedHeight;

        // 计算两种适配方式的尺寸
        const widthFitWidth = markerWidth;
        const widthFitHeight = widthFitWidth / imgAspectRatio;

        const heightFitHeight = markerHeight;
        const heightFitWidth = heightFitHeight * imgAspectRatio;

        // 选择不会超出色块的适配方式
        if (widthFitHeight <= markerHeight) {
            // 宽度适配不会超出高度
            adjustedWidth = widthFitWidth;
            adjustedHeight = widthFitHeight;
        } else {
            // 高度适配不会超出宽度
            adjustedWidth = heightFitWidth;
            adjustedHeight = heightFitHeight;
        }

        // 同步位置和尺寸到预览(顶部对齐)
        $(previewImg).css({
            left: left + 'px',
            top: top + 'px',
            width: adjustedWidth + 'px',
            height: adjustedHeight + 'px',
            'object-fit': 'cover',
            'object-position': 'top'
        });

        // 存储实际尺寸到data属性，供合成使用
        marker.data('actualWidth', adjustedWidth);
        marker.data('actualHeight', adjustedHeight);
    };


    // 存储每个款式图片的激活色块
    const styleItemsData = new WeakMap();

    // 款式图片上传回调
    const styleUploadCallback = (imageData, fileName) => {
        const previewArea = $('#stylePreview');
        // 创建款式图片元素并添加序列号
        const { styleItem, img, deleteBtn } = createStyleElement(imageData);
        img.attr('alt', fileName.split('.')[0]);
        const sequenceNum = $('#stylePreview .style-item').length + 1;

        // 处理图片加载和缩放系数计算
        const imgElement = img[0]; // 获取原生DOM元素

        const handleImageLoad = () => {
            const renderWidth = img.width();
            const naturalWidth = imgElement.naturalWidth;
            if (naturalWidth > 0) {
                globalScaleFactor = (naturalWidth / renderWidth).toFixed(4);
            } else {
                console.warn('图片自然宽度为0，无法计算缩放系数');
            }
        };

        // 延迟检查以确保属性已设置
        setTimeout(() => {
            if (imgElement.complete && imgElement.naturalWidth > 0) {
                console.log('图片已缓存，立即计算');
                handleImageLoad();
            } else {
                console.log('绑定onload/onerror事件');
                imgElement.onload = handleImageLoad;
                imgElement.onerror = () => {
                    console.error('图片加载失败:', imgElement.src);
                    console.error('错误状态:', {
                        complete: imgElement.complete,
                        naturalWidth: imgElement.naturalWidth
                    });
                };
            }
        }, 0);
        const sequenceTag = $(`<div class="sequence-number">${sequenceNum}</div>`);
        const fileNameTag = $(`<div class="file-name">${fileName.split('.')[0]}</div>`);
        styleItem.append(sequenceTag, fileNameTag);

        // 设置删除按钮事件
        deleteBtn.on('click', function (e) {
            e.stopPropagation();
            styleItem.remove();
            // 重新计算款式图片序列号
            $('#stylePreview .style-item').each(function (index) {
                $(this).find('.sequence-number').text(index + 1);
            });
        });

        // 初始化位置标记交互
        const markers = styleItem.find('.position-marker');
        const firstMarker = markers.first();
        styleItemsData.set(styleItem[0], {
            activeMarker: firstMarker,
            markers: markers
        });

        // 设置第一个色块为激活状态
        firstMarker.addClass('selected');

        markers.each(function () {
            const marker = $(this);
            const markerEl = marker[0];
            
            // 初始化标记图片
            const markerImg = marker.find('img');
            if (!markerImg.length) {
                marker.append('<img src="" alt="印花位置" style="width:100%;height:100%;object-fit:contain;">');
            }

            // 确保元素可见且可交互
            markerEl.style.pointerEvents = 'auto';
            markerEl.style.touchAction = 'none';

            try {
                // 使标记可拖动
                interact(markerEl).draggable({
                    inertia: false,
                    modifiers: [
                        interact.modifiers.restrictRect({
                            restriction: 'parent',
                            endOnly: false
                        })
                    ],
                    listeners: {
                        move(event) {
                            // 完全自定义位移计算（覆盖 interact.js 的默认拖拽）
                            const target = event.target;
                            const x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
                            const y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

                            // 手动更新元素位置
                            target.style.transform = `translate(${x}px, ${y}px)`;
                            target.setAttribute('data-x', x);
                            target.setAttribute('data-y', y);
                            
                            // 更新数据属性
                            target.setAttribute('data-width', target.offsetWidth);
                            target.setAttribute('data-height', target.offsetHeight);

                            // 更新预览
                            const itemData = styleItemsData.get(styleItem[0]);
                            if (selectedStamp && marker.hasClass('selected')) {
                                updateStampPreview(styleItem, marker);
                            }
                        }
                    }
                });

                // 使标记可缩放(以左上角为原点，严格保持比例)
                interact(markerEl).resizable({
                    edges: { left: false, right: true, bottom: true, top: false },
                    preserveAspectRatio: true,
                    inertia: false,
                    modifiers: [
                        interact.modifiers.restrictSize({
                            min: { width: 30, height: 30 }
                        }),
                        interact.modifiers.aspectRatio({
                            ratio: 'preserve',
                            equalDelta: true // 强制保持比例
                        })
                    ],
                    // 添加视觉反馈
                    onstart: function (event) {
                        event.target.classList.add('resizing-locked');
                    },
                    onend: function (event) {
                        event.target.classList.remove('resizing-locked');
                    },
                    listeners: {
                        start(event) {
                            const target = event.target;
                            // 保存初始位置和原始尺寸
                            target.style.width = `${target.offsetWidth}px`;
                            target.style.height = `${target.offsetHeight}px`;

                        },
                        move(event) {
                            const target = event.target;
                            const aspectRatio = parseFloat(target.style.width) / parseFloat(target.style.height);
                            // 根据拖动方向保持比例
                            let width, height;
                            if (event.edges.right) {
                                width = event.rect.width;
                                height = width / aspectRatio;
                            } else if (event.edges.bottom) {
                                height = event.rect.height;
                                width = height * aspectRatio;
                            }

                            // 应用保持比例的尺寸
                            target.style.width = `${width}px`;
                            target.style.height = `${height}px`;
                            // 更新预览
                            const itemData = styleItemsData.get(styleItem[0]);
                            if (selectedStamp && marker.hasClass('selected')) {
                                updateStampPreview(styleItem, itemData.activeMarker);
                            }
                        }
                    }
                });

                // 点击选择标记
                marker.on('mousedown touchstart', function (e) {
                    e.stopPropagation();
                    const itemData = styleItemsData.get(styleItem[0]);
                    itemData.activeMarker = marker;
                    itemData.markers.removeClass('selected');
                    marker.addClass('selected');

                    if (selectedStamp) {
                        updateStampPreview(styleItem, marker);
                    }
                });

                console.log('位置标记交互初始化完成');
            } catch (error) {
                console.error('初始化交互失败:', error);
            }
        });

        // 添加元素到DOM（添加到最前面）并添加新上传标记
        styleItem.append(img, deleteBtn);
        previewArea.prepend(styleItem);
    };

    // 印花图片上传回调
    const stampUploadCallback = (imageData, fileName) => {
        const previewArea = $('#stampPreview');
        // 创建印花图片元素并添加序列号
        const { stampItem, img, deleteBtn } = createStampElement(imageData);
        img.attr('alt', fileName.split('.')[0]);
        const sequenceNum = $('#stampPreview .stamp-item').length + 1;
        const sequenceTag = $(`<div class="sequence-number">${sequenceNum}</div>`);
        const fileNameTag = $(`<div class="file-name">${fileName.split('.')[0]}</div>`);
        stampItem.append(sequenceTag, fileNameTag);

        // 设置删除按钮事件
        deleteBtn.on('click', function (e) {
            e.stopPropagation();
            stampItem.remove();
            // 重新计算印花图片序列号
            $('#stampPreview .stamp-item').each(function (index) {
                $(this).find('.sequence-number').text(index + 1);
            });
        });

        // 点击印花图片选择位置
        stampItem.on('click', function (e) {
            const stampName = $(this).find('img').attr('alt')
            // 获取当前点击的印花图片
            const stampImgSrc = $(this).find('img').attr('src');

            // 更新所有款式图片中激活色块的图片
            $('#stylePreview .style-item').each(function () {
                const styleItem = $(this);
                const itemData = styleItemsData.get(styleItem[0]);

                if (itemData && itemData.activeMarker) {
                    // 直接更新激活色块中的图片
                    itemData.activeMarker.find('img').attr('src', stampImgSrc);

                    // 更新预览
                    updateStampPreview(styleItem, itemData.activeMarker, stampName);
                }
            });
        });

        // 添加元素到DOM（添加到最前面）并添加视觉反馈
        stampItem.append(img, deleteBtn);
        previewArea.prepend(stampItem);
        // 添加视觉反馈
        stampItem.addClass('new-upload')
            .css('opacity', 0)
            .animate({ opacity: 1 }, 300);
        setTimeout(() => stampItem.removeClass('new-upload'), 900);
    };

    // 设置款式图片上传
    setupDragUpload(
        $('#styleUpload').parent('.upload-container'),
        '#styleUpload',
        'style',
        styleUploadCallback
    );

    // 设置印花图片上传
    setupDragUpload(
        $('#stampUpload').parent('.upload-container'),
        '#stampUpload',
        'stamp',
        stampUploadCallback
    );



    // 当前选中的印花图片
    let selectedStamp = null;

    // 印花点击事件 - 选择印花并更新所有款式图片中激活色块的图片
    $(document).on('click', '.stamp-item', function (e) {
        // 获取点击的印花图片
        const stampImg = $(this).find('img');
        selectedStamp = stampImg.attr('src');
        const stampName = stampImg.attr('alt') || '印花';

        // 更新所有款式图片中激活色块的图片
        $('#stylePreview .style-item').each(function () {
            const styleItem = $(this);
            const itemData = styleItemsData.get(styleItem[0]);
            
            if (itemData && itemData.activeMarker) {
                // 更新激活色块中的图片
                const markerImg = itemData.activeMarker.find('img');
                markerImg.attr('src', selectedStamp);
                markerImg.attr('alt', stampName);
            }
        });
    });


    // 提取文件名逻辑
    function getOriginalName(styleItem) {
        const styleName = styleItem.find('.styleBg').attr('alt') || '款式';
        const stampPreview = styleItem.find('.stampReview');

        // 如果没有印花预览，只使用款式名称
        if (stampPreview.length === 0) {
            return styleName.split('.')[0];
        }

        // 有印花时使用"款式-印花"格式
        const stampName = stampPreview.attr('alt') || '印花';
        return `${styleName.split('.')[0]}-${stampName}`;
    }

    // 显示下载蒙层
    function showDownloadOverlay(message, isError) {
        const overlay = document.querySelector('.download-overlay');
        const progressText = document.querySelector('.progress-text');
        const progressBar = document.querySelector('.progress-bar');

        progressText.textContent = message;
        if (isError) {
            progressBar.style.display = 'none';
        } else {
            progressBar.style.display = 'block';
        }
        overlay.classList.add('active');
    }

    // 隐藏下载蒙层
    function hideDownloadOverlay() {
        const overlay = document.querySelector('.download-overlay');
        overlay.classList.remove('active');
    }

    // 提取下载逻辑
    function triggerDownload(imageData, name) {
        try {
            // 确保传入的是有效的图片数据
            if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
                throw new Error('无效的图片数据');
            }

            // 显示下载进度
            showDownloadOverlay('正在下载...', false);

            const link = document.createElement('a');
            // 强制设置下载文件名，避免浏览器自动修改
            link.setAttribute('download', `${name}.jpg`);
            link.href = imageData;
            
            // 添加临时样式确保点击有效
            link.style.display = 'none';
            document.body.appendChild(link);
            
            // 使用更可靠的点击事件触发方式
            const clickEvent = new MouseEvent('click', {
                view: window,
                bubbles: true,
                cancelable: true
            });
            link.dispatchEvent(clickEvent);
            
            // 延迟移除以确保下载开始
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
                // 显示下载完成提示
                showDownloadOverlay('下载完成', false);
                // 2秒后自动隐藏
                setTimeout(hideDownloadOverlay, 2000);
            }, 100);
        } catch (e) {
            console.error('图片下载失败:', e);
            showDownloadOverlay(`下载失败: ${e.message}`, true);
            setTimeout(hideDownloadOverlay, 3000);
        }
    }

    // 合成按钮事件处理
    $('#mixbutton').on('click', async function () {
        $('.position-marker').hide();
        const styleItems = $('#stylePreview .style-item');
        const stampItems = $('#stampPreview .stamp-item');
        let successCount = 0;

        // 检查是否有款式和印花图片
        if (styleItems.length === 0 || stampItems.length === 0) {
            alert('请先上传款式和印花图片');
            $('.position-marker').show();
            return;
        }

        // 使用for循环确保顺序执行
        for (let i = 0; i < styleItems.length; i++) {
            const styleItem = $(styleItems[i]);
            const styleImg = styleItem.find('img.styleBg')[0];
            
            try {
                // 等待款式图片加载完成
                if (!styleImg || !styleImg.complete || !styleImg.naturalWidth) {
                    await new Promise((resolve) => {
                        styleImg.onload = resolve;
                        styleImg.onerror = () => {
                            console.error('款式图片加载失败');
                            resolve();
                        };
                    });
                }

                // 检查款式图片是否有效
                if (!styleImg.naturalWidth) {
                    continue;
                }

                // 为每个印花图片创建合成任务
                for (let j = 0; j < stampItems.length; j++) {
                    const stampItem = $(stampItems[j]);
                    const stampImg = stampItem.find('img')[0];
                    const stampName = stampItem.find('img').attr('alt') || `印花${j + 1}`;

                    // 等待印花图片加载完成
                    if (!stampImg || !stampImg.complete || !stampImg.naturalWidth) {
                        await new Promise((resolve) => {
                            stampImg.onload = resolve;
                            stampImg.onerror = () => {
                                console.error('印花图片加载失败');
                                resolve();
                            };
                        });
                    }

                    // 检查印花图片是否有效
                    if (!stampImg.naturalWidth) {
                        continue;
                    }

                    // 创建独立Canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // 执行合成
                    await new Promise((resolve) => {
                        setTimeout(async () => {
                            try {
                                if (await compositeImages(styleItem, canvas, ctx, stampImg.src, stampName)) {
                                    successCount++;
                                }
                            } catch (e) {
                                console.error('合成失败:', e);
                            } finally {
                                // 释放资源
                                canvas.width = 0;
                                canvas.height = 0;
                                resolve();
                            }
                        }, 200); // 添加延迟避免浏览器阻塞
                    });
                }
            } catch (e) {
                console.error('处理款式图片时出错:', e);
            }
        }

        // 显示合成结果统计
        $('.position-marker').show();
        if (successCount > 0) {
            // alert(`成功合成 ${successCount} 张图片`);
        } else {
            alert('合成失败，请检查图片和设置');
        }
    });

    // 使用全局缩放系数的合成函数
    async function compositeImages(styleItem, canvas, ctx, stampImgSrc, stampName) {
        const styleImg = styleItem.find('img.styleBg')[0];
        // 使用图片自然尺寸设置Canvas
        const canvasWidth = styleImg.naturalWidth;
        const canvasHeight = styleImg.naturalHeight;
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        
        // 绘制基础款式图片
        ctx.drawImage(styleImg, 0, 0, canvasWidth, canvasHeight);
        
        // 创建临时图片元素用于加载印花
        const stampImg = new Image();
        stampImg.crossOrigin = 'Anonymous';
        stampImg.src = stampImgSrc;
        
        // 等待印花图片加载
        await new Promise((resolve) => {
            stampImg.onload = resolve;
            stampImg.onerror = () => {
                console.error('印花图片加载失败');
                resolve();
            };
        });

        // 获取激活的位置标记
        const marker = styleItem.find('.position-marker.selected');
        if (!marker.length) {
            console.error('未找到激活的位置标记');
            return false;
        }
        
        // 从marker的数据属性获取位置和尺寸
        const x = parseFloat(marker.attr('data-x')) || 0;
        const y = parseFloat(marker.attr('data-y')) || 0;
        const width = parseFloat(marker.attr('data-width')) || 0;
        const height = parseFloat(marker.attr('data-height')) || 0;

        // 获取印花图片原始比例
        const naturalWidth = stampImg.naturalWidth;
        const naturalHeight = stampImg.naturalHeight;
        const aspectRatio = naturalWidth / naturalHeight;

        // 计算保持比例的尺寸
        let keepRatioWidth = width;
        let keepRatioHeight = width / aspectRatio;
        
        // 如果按宽度计算的高度超过容器高度，则按高度计算
        if (keepRatioHeight > height) {
            keepRatioHeight = height;
            keepRatioWidth = height * aspectRatio;
        }

        // 应用全局缩放系数
        const scaledX = x * globalScaleFactor;
        const scaledY = y * globalScaleFactor;
        const scaledWidth = keepRatioWidth * globalScaleFactor;
        const scaledHeight = keepRatioHeight * globalScaleFactor;

        // 保存当前Canvas状态
        ctx.save();
        
        try {
            // 高质量绘制(保持原始比例)
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            // 绘制印花图片
            ctx.drawImage(
                stampImg,
                0, 0, naturalWidth, naturalHeight, // 源图像裁剪区域(使用完整图像)
                scaledX, scaledY, scaledWidth, scaledHeight // 画布上的位置和尺寸
            );
            
            // 绘制印花图片
            ctx.drawImage(
                stampImg,
                0, 0, naturalWidth, naturalHeight,
                scaledX, scaledY, scaledWidth, scaledHeight
            );
        } catch (e) {
            console.error('绘制印花时出错:', e);
            return false;
        } finally {
            // 恢复Canvas状态
            ctx.restore();
        }

        try {
            let imageData = canvas.toDataURL('image/jpeg', 0.7);
            // 生成包含印花名称的文件名（印花名+款式名）
            const styleName = styleItem.find('.styleBg').attr('alt') || '';
            const fileName = `${styleName.split('.')[0]}${stampName.split('.')[0]}`;
            
            // 触发下载
            triggerDownload(imageData, fileName);
            return true;
        } catch (e) {
            console.error('生成图片数据失败:', e);
            return false;
        }
    }
});