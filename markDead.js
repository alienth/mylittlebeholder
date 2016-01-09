on("change:graphic:bar1_value", function  (obj) {
    if(obj.get("bar1_max") === "") return;

    if(obj.get("bar1_value") <= 0) {
      obj.set({
         status_dead: true
      });
    }
    else {
      obj.set({
        status_dead: false
      });
    }
});
