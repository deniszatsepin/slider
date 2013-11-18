(function() {
  var CarouselController, Model, Observable, SlideChanger, SliderController, View;

  Observable = (function() {
    function Observable(id) {
      this.listeners = {};
      this.getId = function() {
        return id += 1;
      };
    }

    Observable.prototype.publish = function(event, data) {
      var handler, _i, _len, _ref, _results;
      if (!this.listeners[event]) {
        return;
      }
      _ref = this.listeners[event];
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        handler = _ref[_i];
        _results.push(handler.cb.apply(null, [event, data]));
      }
      return _results;
    };

    Observable.prototype.subscribe = function(event, cb) {
      var id;
      if (typeof cb !== 'function') {
        return;
      }
      this.listeners[event] = this.listeners[event] || [];
      id = this.getId();
      this.listeners[event].push({
        id: id,
        cb: cb
      });
      return id;
    };

    Observable.prototype.unsubscribe = function(event, id) {
      var handler, _i, _len, _ref;
      if (!this.listeners[event]) {
        return;
      }
      _ref = this.listeners[event];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        handler = _ref[_i];
        if (handler.id === id) {
          this.listeners[event].splice(_i, 1);
          return true;
        }
      }
      return false;
    };

    return Observable;

  })();

  SlideChanger = {
    simple: function(firstSlide, secondSlide, back) {
      var $first, $second, width;
      $first = $(firstSlide);
      $second = $(secondSlide);
      width = this.$root.width();
      if (back) {
        $second.insertBefore($first);
        $first.css('top', '0px').css('left', '0px');
        $second.css('top', '0px').css('left', '-' + width + 'px');
      } else {
        $second.insertAfter($first);
        $first.css('top', '0px').css('left', '0px');
        $second.css('top', '0px').css('left', width + 'px');
      }
      $first.css('display', 'block');
      $second.css('display', 'block');
      if (back) {
        $first.animate({
          left: '+=' + width
        });
        $second.animate({
          left: '+=' + width
        }, {
          complete: $.proxy(function($first) {
            this.animating = false;
            return $first.css('display', 'none');
          }, this, $first)
        });
      } else {
        $first.animate({
          left: '-=' + width
        });
        $second.animate({
          left: '-=' + width
        }, {
          complete: $.proxy(function($first) {
            this.animating = false;
            return $first.css('display', 'none');
          }, this, $first)
        });
      }
      return void 0;
    }
  };

  Model = (function() {
    function Model(images) {
      this.images = [];
      this.current = 0;
      this.prev = 0;
      this.observable = new Observable();
      if (images) {
        this.changeSource(images);
      }
    }

    Model.prototype.changeSource = function(images) {
      this.images = [];
      this.current = 0;
      this.prev = 0;
      _.forEach(images, function(img, pos) {
        var image;
        image = {
          src: img.url,
          url: 'img/loading.gif',
          img: new Image(),
          loaded: false,
          pos: pos
        };
        image.img.src = image.src;
        $(image.img).load(image, $.proxy(function(e) {
          e.handleObj.data.loaded = true;
          return this.observable.publish('loaded', e.handleObj.data.pos);
        }, this));
        return this.images.push(image);
      }, this);
      return this.observable.publish('source', this.images);
    };

    Model.prototype.setNext = function(next) {
      this.prev = this.current;
      if (typeof next !== 'undefined') {
        this.current = next < this.images.length ? next : this.current;
      } else {
        this.current = this.current === this.images.length - 1 ? 0 : this.current + 1;
      }
      if (this.prev !== this.current) {
        return this.observable.publish('next', {
          next: this.current,
          prev: this.prev
        });
      }
    };

    Model.prototype.setPrev = function(prev) {
      this.prev = this.current;
      if (typeof prev !== 'undefined') {
        this.current = prev >= 0 ? prev : this.current;
      } else {
        this.current = this.current === 0 ? this.images.length - 1 : this.current - 1;
      }
      if (this.prev !== this.current) {
        return this.observable.publish('prev', {
          next: this.current,
          prev: this.prev
        });
      }
    };

    Model.prototype.setSlide = function(nr) {
      if (typeof nr === 'undefined') {
        return;
      }
      if (this.current > nr) {
        return this.setPrev(nr);
      } else {
        return this.setNext(nr);
      }
    };

    Model.prototype.subscribe = function(event, cb) {
      return this.observable.subscribe(event, cb);
    };

    Model.prototype.unsubscribe = function(event, id) {
      return this.observable.unsubscribe(event, id);
    };

    return Model;

  })();

  View = (function() {
    function View(root, tmpl) {
      var source;
      this.root = root;
      source = tmpl.html();
      this.template = Handlebars.compile(source);
    }

    View.prototype.render = function(data) {
      var html;
      html = this.template(data);
      return this.root.append(html);
    };

    return View;

  })();

  CarouselController = (function() {
    function CarouselController(root, model) {
      this.root = root;
      this.model = model;
      this.view = new View(this.root, $('#z-slider-nav-tmpl'));
      this.commands = [];
      this.max = 20;
      this.animating = false;
      this.onSourceChanged('source', this.model.images);
      this.loopId = setInterval($.proxy(function() {
        return this.loop();
      }, this), 100);
      this.model.subscribe('source', $.proxy(this.onSourceChanged, this));
      this.model.subscribe('next', $.proxy(this.onNextEvent, this));
      this.model.subscribe('prev', $.proxy(this.onPrevEvent, this));
      this.model.subscribe('loaded', $.proxy(this.onImageLoaded, this));
      this.root.on('click', '[data-action="line-left"]', $.proxy(this.onLeftClick, this));
      this.root.on('click', '[data-action="line-right"]', $.proxy(this.onRightClick, this));
      this.root.on('click', '[data-action="slide-set"]', $.proxy(this.onSlideSet, this));
    }

    CarouselController.prototype.onSourceChanged = function(event, data) {
      this.view.render({
        images: data
      });
      this.navWidth = $('section.thumbs', this.root).width();
      this.thumbLine = $('section.thumbs .thumbs-line', this.root);
      this.thumbs = $('.thumb-wrap', this.thumbLine);
      this.elWidth = $(this.thumbs[0]).width();
      this.thumbLine.width(this.elWidth * this.thumbs.length);
      return $(this.thumbs[0]).addClass('active');
    };

    CarouselController.prototype.onImageLoaded = function(event, pos) {
      var $thumb, thumbWrp;
      thumbWrp = this.thumbs[pos];
      $thumb = $('.thumb', thumbWrp);
      return $thumb.css('background-image', 'url(' + this.model.images[pos].src + ')');
    };

    CarouselController.prototype.onLeftClick = function(e) {
      var after, left, right, toMove;
      left = parseInt(this.thumbLine.css('left')) || 0;
      right = this.thumbLine.width() - Math.abs(left);
      if (right <= this.navWidth) {
        return;
      }
      after = right - this.navWidth;
      toMove = after >= this.navWidth ? this.navWidth : after;
      return this.commands.push({
        command: 'moveLeft',
        distance: toMove
      });
    };

    CarouselController.prototype.onRightClick = function(e) {
      var left, toMove;
      left = parseInt(this.thumbLine.css('left')) || 0;
      if (left >= 0) {
        return;
      }
      left = Math.abs(left);
      toMove = left >= this.navWidth ? this.navWidth : left;
      return this.commands.push({
        command: 'moveRight',
        distance: toMove
      });
    };

    CarouselController.prototype.onSlideSet = function(e) {
      var idx;
      idx = parseInt(e.target.getAttribute('data-index'));
      return this.model.setSlide(idx);
    };

    CarouselController.prototype.onNextEvent = function(event, data) {
      if (this.commands.length < this.max) {
        return this.commands.push({
          command: 'next',
          prev: data.prev,
          next: data.next
        });
      }
    };

    CarouselController.prototype.onPrevEvent = function(event, data) {
      if (this.commands.length < this.max) {
        return this.commands.push({
          command: 'prev',
          prev: data.prev,
          next: data.next
        });
      }
    };

    CarouselController.prototype.nextSlide = function(data) {
      var $from, $to, delta, left, right, shouldLeft, toMove;
      $from = $(this.thumbs[data.prev]);
      $to = $(this.thumbs[data.next]);
      $from.removeClass('active');
      $to.addClass('active');
      left = parseInt(this.thumbLine.css('left')) || 0;
      if (data.next === 0) {
        this.navLeft({
          distance: left
        });
        return;
      }
      right = this.thumbLine.width() - Math.abs(left);
      shouldLeft = (data.next + 1) * this.elWidth;
      if (shouldLeft > Math.abs(left) + this.navWidth) {
        delta = shouldLeft - (left + this.navWidth);
        toMove = delta > right - this.navWidth ? right - this.navWidth : delta;
        return this.navLeft({
          distance: toMove
        });
      } else {
        return this.animating = false;
      }
    };

    CarouselController.prototype.prevSlide = function(data) {
      var $from, $to, delta, left, right, shouldLeft;
      $from = $(this.thumbs[data.prev]);
      $to = $(this.thumbs[data.next]);
      $from.removeClass('active');
      $to.addClass('active');
      left = parseInt(this.thumbLine.css('left')) || 0;
      delta = this.thumbLine.width() - this.navWidth;
      if (data.next === this.thumbs.length - 1) {
        this.navLeft({
          distance: delta > 0 ? delta : 0
        });
      }
      right = this.thumbLine.width() - Math.abs(left);
      shouldLeft = data.next * this.elWidth;
      if (shouldLeft < Math.abs(left)) {
        delta = Math.abs(left) - shouldLeft;
        return this.navRight({
          distance: delta
        });
      } else {
        return this.animating = false;
      }
    };

    CarouselController.prototype.navLeft = function(data) {
      return this.thumbLine.animate({
        left: '-=' + data.distance
      }, {
        complete: $.proxy(function() {
          return this.animating = false;
        }, this)
      });
    };

    CarouselController.prototype.navRight = function(data) {
      return this.thumbLine.animate({
        left: '+=' + data.distance
      }, {
        complete: $.proxy(function() {
          return this.animating = false;
        }, this)
      });
    };

    CarouselController.prototype.loop = function() {
      var command;
      if (this.animating) {
        return;
      }
      if (this.commands.length) {
        command = this.commands.shift();
        switch (command.command) {
          case 'next':
            this.animating = true;
            return this.nextSlide(command);
          case 'prev':
            this.animating = true;
            return this.prevSlide(command);
          case 'moveLeft':
            this.animating = true;
            return this.navLeft(command);
          case 'moveRight':
            this.animating = true;
            return this.navRight(command);
        }
      }
    };

    return CarouselController;

  })();

  SliderController = (function() {
    function SliderController(root, model) {
      this.root = root;
      this.model = model;
      this.view = new View(this.root, $('#z-slider-figure-tmpl'));
      this.$root = this.root;
      this.commands = [];
      this.max = 20;
      this.animating = false;
      this.order = [];
      this.onSourceChanged('source', this.model.images);
      this.loopId = setInterval($.proxy(function() {
        return this.loop();
      }, this), 100);
      this.model.subscribe('source', $.proxy(this.onSourceChanged, this));
      this.model.subscribe('next', $.proxy(this.onNextEvent, this));
      this.model.subscribe('prev', $.proxy(this.onPrevEvent, this));
      this.model.subscribe('loaded', $.proxy(this.onImageLoaded, this));
      this.root.on('click', '[data-action="slide-next"]', $.proxy(function(e) {
        return this.onNextClick();
      }, this));
      this.root.on('click', '[data-action="slide-prev"]', $.proxy(function(e) {
        return this.onPrevClick();
      }, this));
    }

    SliderController.prototype.setVisibility = function() {
      var $images, img, _i, _len, _results;
      this.ordered = [];
      $images = $('div.slides > div', this.root);
      _results = [];
      for (_i = 0, _len = $images.length; _i < _len; _i++) {
        img = $images[_i];
        this.ordered.push(img);
        if (_i > 0) {
          _results.push(img.style.display = 'none');
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    SliderController.prototype.onSourceChanged = function(event, data) {
      this.view.render({
        images: data
      });
      return this.setVisibility();
    };

    SliderController.prototype.onImageLoaded = function(event, pos) {
      var $img, wrp;
      wrp = this.ordered[pos];
      $img = $('img', wrp);
      return $img.attr('src', this.model.images[pos].src);
    };

    SliderController.prototype.onNextClick = function() {
      return this.model.setNext();
    };

    SliderController.prototype.onPrevClick = function() {
      return this.model.setPrev();
    };

    SliderController.prototype.onNextEvent = function(event, data) {
      if (this.commands.length < this.max) {
        return this.commands.push({
          command: 'next',
          prev: data.prev,
          next: data.next
        });
      }
    };

    SliderController.prototype.onPrevEvent = function(event, data) {
      if (this.commands.length < this.max) {
        return this.commands.push({
          command: 'prev',
          prev: data.prev,
          next: data.next
        });
      }
    };

    SliderController.prototype.nextSlide = function(data) {
      var from, to;
      from = this.ordered[data.prev];
      to = this.ordered[data.next];
      return SlideChanger['simple'].call(this, from, to);
    };

    SliderController.prototype.prevSlide = function(data) {
      var from, to;
      from = this.ordered[data.prev];
      to = this.ordered[data.next];
      return SlideChanger['simple'].call(this, from, to, true);
    };

    SliderController.prototype.loop = function() {
      var command;
      if (this.animating) {
        return;
      }
      if (this.commands.length) {
        command = this.commands.shift();
        switch (command.command) {
          case 'next':
            this.nextSlide(command);
            return this.animating = true;
          case 'prev':
            this.prevSlide(command);
            return this.animating = true;
        }
      }
    };

    return SliderController;

  })();

  $.fn.zslider = function(options) {
    var defaults, settings;
    defaults = {
      controls: 'bottom',
      slide: 'simple'
    };
    settings = $.extend({}, defaults, options);
    return this.each(function() {
      var carouselController, container, figure, model, nav, sliderController;
      console.log('args: ', arguments);
      model = new Model(settings.images);
      container = $('<section class="z-slider-container"></section>');
      container.appendTo(this);
      figure = $('<figure></figure>');
      figure.appendTo(container);
      nav = $('<nav></nav>');
      nav.appendTo(container);
      sliderController = new SliderController(figure, model);
      carouselController = new CarouselController(nav, model);
      $(this).zpresenter = {
        setSource: function(src) {
          return model.setSource(src);
        }
      };
      return this;
    });
  };

}).call(this);
