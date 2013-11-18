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
      if (next) {
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

    Model.prototype.setPrev = function() {
      this.prev = this.current;
      this.current = this.current === 0 ? this.images.length - 1 : this.current - 1;
      return this.observable.publish('next', {
        next: this.current,
        prev: this.prev
      });
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
    function CarouselController() {
      this.observable = new Observable();
      this.model = new Model();
      this.view = new View();
    }

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
      this.onSourceChanged('source', this.model.images);
      this.loopId = setInterval($.proxy(function() {
        return this.loop();
      }, this), 1000);
      this.model.subscribe('source', $.proxy(this.onSourceChanged, this));
      this.model.subscribe('next', $.proxy(this.onNextEvent, this));
      this.model.subscribe('prev', $.proxy(this.onPrevEvent, this));
      this.root.on('click', '[data-action="slide-next"]', $.proxy(function(e) {
        return this.onNextClick();
      }, this));
      this.root.on('click', '[data-action="slide-prev"]', $.proxy(function(e) {
        return this.onPrevClick();
      }, this));
    }

    SliderController.prototype.setVisibility = function() {
      var $images, img, _i, _len, _results;
      $images = $('div.slides > div', this.root);
      _results = [];
      for (_i = 0, _len = $images.length; _i < _len; _i++) {
        img = $images[_i];
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
      var from, slides, to;
      slides = $('div.slides > div', this.root);
      from = slides[data.prev];
      to = slides[data.next];
      return SlideChanger['simple'].call(this, from, to);
    };

    SliderController.prototype.prevSlide = function(data) {
      var from, slides, to;
      slides = $('div.slides > div', this.root);
      from = slides[data.prev];
      to = slides[data.next];
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
      var container, figure, model, nav, sliderController;
      console.log('args: ', arguments);
      model = new Model(settings.images);
      container = $('<section class="z-slider-container"></section>');
      container.appendTo(this);
      figure = $('<figure></figure>');
      figure.appendTo(container);
      nav = $('<nav></nav>');
      nav.appendTo(container);
      sliderController = new SliderController(figure, model);
      $(this).zpresenter = {
        setSource: function(src) {
          return model.setSource(src);
        }
      };
      return this;
    });
  };

}).call(this);
