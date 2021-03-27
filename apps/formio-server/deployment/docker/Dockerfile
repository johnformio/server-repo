FROM        alpine:latest
MAINTAINER  Form.io <support@form.io>

# Install the latest versions from edge
RUN sed -i -e 's/v[[:digit:]]\..*\//edge\//g' /etc/apk/repositories &&\
    apk add --upgrade \
    nodejs npm nghttp2 nghttp2-libs &&\
    apk del git wget curl &&\
    rm -rf /var/lib/apt/lists/* &&\
    rm /var/cache/apk/* &&\
    rm -f /etc/fstab &&\
    crontab -r &&\
    find / -name wget -delete &&\
    rm -fr /etc/init.d /lib/rc /etc/conf.d /etc/inittab /etc/runlevels /etc/rc.conf /etc/logrotate.d &&\
    rm -fr /etc/sysctl* /etc/modprobe.d /etc/modules /etc/mdev.conf /etc/acpi && \
    find /bin /etc /lib /sbin /usr -xdev -type f -a \( -perm +4000 -o -perm +2000 \) -delete &&\
    find / -xdev -type l ! -exec test -e {} \; -delete

COPY        ./build /src
WORKDIR     /src

EXPOSE      80
CMD  ["node", "formio.js", "--max_old_space_size=4096"]
